package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * 快乐8推荐策略。负责校验 AI 输出，并在 AI 不可用时生成规则降级推荐。
 */
@Service
public class LotteryKl8RecommendationPolicy {

    private static final int GROUP_COUNT = 5;
    private static final int GROUP_SIZE = 5;
    private static final Set<String> CONFIDENCE_LABELS = Set.of("低", "中低", "中");

    private final ObjectMapper objectMapper;

    /**
     * 创建推荐策略。
     *
     * @param objectMapper JSON 解析器
     */
    public LotteryKl8RecommendationPolicy(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 从 AI 文本中解析并校验 5 组推荐。
     *
     * @param content AI 输出文本
     * @return 通过校验的推荐组
     */
    public List<LotteryKl8RecommendationGroupVO> validateAiContent(String content) {
        return validateAiResult(content).groups();
    }

    /**
     * 从 AI 文本中解析并校验深度推荐结果。
     *
     * @param content AI 输出文本
     * @return 通过校验的深度推荐结果
     */
    public ValidatedRecommendation validateAiResult(String content) {
        try {
            JsonNode root = objectMapper.readTree(extractJson(content));
            JsonNode groupsNode = root.isArray() ? root : root.path("groups");
            if (!groupsNode.isArray()) {
                throw new IllegalArgumentException("AI 未返回 groups 数组");
            }
            List<LotteryKl8RecommendationGroupVO> groups = new ArrayList<>();
            for (JsonNode item : groupsNode) {
                JsonNode numbersNode = item.path("numbers");
                if (!numbersNode.isArray()) {
                    throw new IllegalArgumentException("推荐号码不是数组");
                }
                List<Integer> numbers = new ArrayList<>();
                for (JsonNode numberNode : numbersNode) {
                    numbers.add(numberNode.asInt(-1));
                }
                String reason = item.path("reason").asText("");
                groups.add(validateGroup(numbers, reason));
            }
            List<LotteryKl8RecommendationGroupVO> validatedGroups = validateGroups(groups);
            String confidenceLabel = root.isObject() && CONFIDENCE_LABELS.contains(root.path("confidenceLabel").asText())
                    ? root.path("confidenceLabel").asText()
                    : "中低";
            ObjectNode analysis = normalizeAnalysis(root, confidenceLabel);
            List<String> warnings = readWarnings(analysis.path("analysis").path("riskWarnings"));
            return new ValidatedRecommendation(validatedGroups, objectMapper.writeValueAsString(analysis), confidenceLabel, warnings);
        } catch (Exception e) {
            throw new IllegalArgumentException("AI 推荐输出不合规", e);
        }
    }

    /**
     * 根据历史特征生成带分析 JSON 的规则降级推荐。
     *
     * @param report 历史特征报告
     * @return 规则降级推荐结果
     */
    public ValidatedRecommendation fallbackResult(LotteryKl8FeatureReport report) {
        List<LotteryKl8RecommendationGroupVO> groups = fallbackGroups(report);
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("confidenceLabel", "低");
            ObjectNode analysis = root.putObject("analysis");
            analysis.put("overview", "AI 推荐不可用，已使用后端深度候选池按规则生成 5 组号码。");
            ArrayNode featureSignals = analysis.putArray("featureSignals");
            report.analysisSections().forEach(featureSignals::add);
            ArrayNode combinationLogic = analysis.putArray("combinationLogic");
            combinationLogic.add("每组从热号、冷号、高遗漏和趋势候选中分散抽取，避免完全依赖单一信号。");
            combinationLogic.add("组内号码按升序展示，并控制重复组合。");
            ArrayNode warnings = analysis.putArray("riskWarnings");
            warnings.add("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
            warnings.add("规则推荐仅在 AI 不可用时作为娱乐参考。");
            return new ValidatedRecommendation(groups, objectMapper.writeValueAsString(root), "低",
                    List.of("彩票开奖结果具有独立随机性，历史统计不能保证命中。", "规则推荐仅在 AI 不可用时作为娱乐参考。"));
        } catch (Exception e) {
            throw new IllegalStateException("快乐8规则分析结果序列化失败", e);
        }
    }

    /**
     * 根据历史特征生成规则降级推荐。
     *
     * @param report 历史特征报告
     * @return 5 组规则推荐
     */
    public List<LotteryKl8RecommendationGroupVO> fallbackGroups(LotteryKl8FeatureReport report) {
        if (!report.optimizedPortfolio().groups().isEmpty()) {
            return validateGroups(report.optimizedPortfolio().groups().stream()
                    .map(group -> new LotteryKl8RecommendationGroupVO(group.numbers(), group.reason()))
                    .toList());
        }
        Random random = new Random(System.nanoTime());
        List<LotteryKl8RecommendationGroupVO> groups = new ArrayList<>();
        Set<String> used = new HashSet<>();
        int cursor = 0;
        List<Integer> candidateNumbers = candidateNumbers(report);
        while (groups.size() < GROUP_COUNT) {
            LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
            push(numbers, candidateNumbers, cursor, 2);
            push(numbers, report.hotNumbers(), cursor + 3, 1);
            push(numbers, missingCandidates(report), cursor + 5, 1);
            push(numbers, report.coldNumbers(), cursor + 7, 1);
            while (numbers.size() < GROUP_SIZE) {
                numbers.add(random.nextInt(80) + 1);
            }
            List<Integer> sorted = numbers.stream().sorted().toList();
            String key = sorted.toString();
            if (used.add(key)) {
                groups.add(new LotteryKl8RecommendationGroupVO(
                        sorted,
                        "规则降级推荐：结合深度候选池、热号、冷号、遗漏和随机扰动生成，仅作娱乐参考。"));
            }
            cursor += 1;
        }
        return validateGroups(groups);
    }

    private List<LotteryKl8RecommendationGroupVO> validateGroups(List<LotteryKl8RecommendationGroupVO> groups) {
        if (groups.size() != GROUP_COUNT) {
            throw new IllegalArgumentException("必须返回 5 组推荐");
        }
        Set<String> used = new HashSet<>();
        List<LotteryKl8RecommendationGroupVO> result = new ArrayList<>();
        for (LotteryKl8RecommendationGroupVO group : groups) {
            LotteryKl8RecommendationGroupVO validated = validateGroup(group.numbers(), group.reason());
            String key = validated.numbers().toString();
            if (!used.add(key)) {
                throw new IllegalArgumentException("推荐组合重复");
            }
            result.add(validated);
        }
        return result;
    }

    private LotteryKl8RecommendationGroupVO validateGroup(List<Integer> numbers, String reason) {
        if (numbers.size() != GROUP_SIZE) {
            throw new IllegalArgumentException("每组必须 5 个号码");
        }
        LinkedHashSet<Integer> unique = new LinkedHashSet<>();
        for (Integer number : numbers) {
            if (number == null || number < 1 || number > 80) {
                throw new IllegalArgumentException("号码必须在 1 到 80 之间");
            }
            unique.add(number);
        }
        if (unique.size() != GROUP_SIZE) {
            throw new IllegalArgumentException("组内号码不能重复");
        }
        String finalReason = reason == null || reason.isBlank()
                ? "基于历史开奖特征生成的统计参考组合。"
                : reason.trim();
        return new LotteryKl8RecommendationGroupVO(unique.stream().sorted().toList(), finalReason);
    }

    private void push(LinkedHashSet<Integer> target, List<Integer> source, int offset, int count) {
        for (int i = 0; i < count && !source.isEmpty(); i += 1) {
            target.add(source.get(Math.floorMod(offset + i, source.size())));
        }
    }

    private List<Integer> missingCandidates(LotteryKl8FeatureReport report) {
        return report.missingNumbers().entrySet().stream()
                .sorted((left, right) -> right.getValue().compareTo(left.getValue()))
                .limit(20)
                .map(java.util.Map.Entry::getKey)
                .toList();
    }

    private List<Integer> candidateNumbers(LotteryKl8FeatureReport report) {
        if (!report.candidatePool().isEmpty()) {
            return report.candidatePool().stream()
                    .sorted(Comparator.comparingDouble(LotteryKl8CandidateNumber::score).reversed()
                            .thenComparing(LotteryKl8CandidateNumber::number))
                    .map(LotteryKl8CandidateNumber::number)
                    .toList();
        }
        return report.hotNumbers();
    }

    private ObjectNode normalizeAnalysis(JsonNode root, String confidenceLabel) {
        ObjectNode normalized = objectMapper.createObjectNode();
        normalized.put("confidenceLabel", confidenceLabel);
        ObjectNode analysis = normalized.putObject("analysis");
        JsonNode source = root.path("analysis");
        if (source.isObject()) {
            copyText(source, analysis, "overview", "AI 基于历史特征和候选池生成推荐。");
            copyArray(source, analysis, "featureSignals");
            copyArray(source, analysis, "combinationLogic");
            copyArray(source, analysis, "riskWarnings");
        } else {
            analysis.put("overview", "AI 基于历史特征和候选池生成推荐。");
            analysis.putArray("featureSignals");
            analysis.putArray("combinationLogic");
            analysis.putArray("riskWarnings").add("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
        }
        if (analysis.path("riskWarnings").isEmpty()) {
            ((ArrayNode) analysis.path("riskWarnings")).add("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
        }
        return normalized;
    }

    private void copyText(JsonNode source, ObjectNode target, String fieldName, String fallback) {
        String value = source.path(fieldName).asText("");
        target.put(fieldName, value.isBlank() ? fallback : value);
    }

    private void copyArray(JsonNode source, ObjectNode target, String fieldName) {
        ArrayNode targetArray = target.putArray(fieldName);
        JsonNode sourceArray = source.path(fieldName);
        if (sourceArray.isArray()) {
            for (JsonNode item : sourceArray) {
                String value = item.asText("");
                if (!value.isBlank()) {
                    targetArray.add(value);
                }
            }
        }
    }

    private List<String> readWarnings(JsonNode warningsNode) {
        if (!warningsNode.isArray()) {
            return List.of("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
        }
        List<String> warnings = new ArrayList<>();
        for (JsonNode item : warningsNode) {
            String value = item.asText("");
            if (!value.isBlank()) {
                warnings.add(value);
            }
        }
        if (warnings.isEmpty()) {
            return List.of("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
        }
        return warnings;
    }

    private String extractJson(String content) {
        String clean = content == null ? "" : content.trim()
                .replaceAll("(?s)^```json\\s*", "")
                .replaceAll("(?s)^```\\s*", "")
                .replaceAll("(?s)\\s*```$", "")
                .trim();
        int objectStart = clean.indexOf('{');
        int arrayStart = clean.indexOf('[');
        int start;
        int end;
        if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
            start = arrayStart;
            end = clean.lastIndexOf(']');
        } else {
            start = objectStart;
            end = clean.lastIndexOf('}');
        }
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("AI 响应中没有 JSON");
        }
        return clean.substring(start, end + 1);
    }

    /**
     * 已校验的快乐8推荐结果。
     *
     * @param groups          5 组推荐号码
     * @param analysisJson    深度分析 JSON
     * @param confidenceLabel 置信标签，仅表达统计参考强弱
     * @param riskWarnings    风险提示列表
     */
    public record ValidatedRecommendation(
            List<LotteryKl8RecommendationGroupVO> groups,
            String analysisJson,
            String confidenceLabel,
            List<String> riskWarnings
    ) {
    }
}
