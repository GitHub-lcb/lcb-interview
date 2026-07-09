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
 * 快乐8推荐策略。负责校验推荐输出，并生成纯 Java 规则推荐，支持选1到选10玩法。
 */
@Service
public class LotteryKl8RecommendationPolicy {

    /** 默认每组 5 个号码，兼容旧记录和旧调用方 */
    public static final int DEFAULT_PICK_SIZE = 5;
    private static final int GROUP_COUNT = 1;
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
     * 从 AI 文本中解析并校验 1 组推荐（默认选5）。
     *
     * @param content AI 输出文本
     * @return 通过校验的推荐组
     */
    public List<LotteryKl8RecommendationGroupVO> validateAiContent(String content) {
        return validateAiContent(content, DEFAULT_PICK_SIZE);
    }

    /**
     * 从 AI 文本中解析并校验 1 组推荐。
     *
     * @param content  AI 输出文本
     * @param pickSize 每组号码数量（1-10）
     * @return 通过校验的推荐组
     */
    public List<LotteryKl8RecommendationGroupVO> validateAiContent(String content, int pickSize) {
        return validateAiResult(content, pickSize).groups();
    }

    /**
     * 从 AI 文本中解析并校验深度推荐结果（默认选5）。
     *
     * @param content AI 输出文本
     * @return 通过校验的深度推荐结果
     */
    public ValidatedRecommendation validateAiResult(String content) {
        return validateAiResult(content, DEFAULT_PICK_SIZE);
    }

    /**
     * 从 AI 文本中解析并校验深度推荐结果。
     *
     * @param content  AI 输出文本
     * @param pickSize 每组号码数量（1-10）
     * @return 通过校验的深度推荐结果
     */
    public ValidatedRecommendation validateAiResult(String content, int pickSize) {
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
                groups.add(validateGroup(numbers, reason, pickSize));
            }
            List<LotteryKl8RecommendationGroupVO> validatedGroups = validateGroups(groups, pickSize);
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
     * 根据历史特征生成带分析 JSON 的 Java 规则推荐（默认选5）。
     *
     * @param report 历史特征报告
     * @return Java 规则推荐结果
     */
    public ValidatedRecommendation fallbackResult(LotteryKl8FeatureReport report) {
        return fallbackResult(report, DEFAULT_PICK_SIZE);
    }

    /**
     * 根据历史特征生成带分析 JSON 的 Java 规则推荐。
     *
     * @param report   历史特征报告
     * @param pickSize 每组号码数量（1-10）
     * @return Java 规则推荐结果
     */
    public ValidatedRecommendation fallbackResult(LotteryKl8FeatureReport report, int pickSize) {
        return fallbackResult(report, null, pickSize);
    }

    /**
     * 根据历史特征生成带分析 JSON 的 Java 规则推荐，并兼容旧 AI 失败诊断（默认选5）。
     *
     * @param report        历史特征报告
     * @param failureDetail AI 失败诊断，可为空
     * @return Java 规则推荐结果
     */
    public ValidatedRecommendation fallbackResult(LotteryKl8FeatureReport report, LotteryKl8AiFailureDetail failureDetail) {
        return fallbackResult(report, failureDetail, DEFAULT_PICK_SIZE);
    }

    /**
     * 根据历史特征生成带分析 JSON 的 Java 规则推荐，并兼容旧 AI 失败诊断。
     *
     * @param report        历史特征报告
     * @param failureDetail AI 失败诊断，可为空
     * @param pickSize      每组号码数量（1-10）
     * @return Java 规则推荐结果
     */
    public ValidatedRecommendation fallbackResult(LotteryKl8FeatureReport report, LotteryKl8AiFailureDetail failureDetail, int pickSize) {
        List<LotteryKl8RecommendationGroupVO> groups = fallbackGroups(report, pickSize);
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("confidenceLabel", "低");
            if (failureDetail != null) {
                ObjectNode aiFallback = root.putObject("aiFallback");
                aiFallback.put("code", failureDetail.code());
                aiFallback.put("message", failureDetail.message());
                aiFallback.put("detail", failureDetail.detail());
            }
            ObjectNode analysis = root.putObject("analysis");
            String overview = failureDetail == null
                    ? "已使用后端 Java 回测策略生成 1 组号码。"
                    : "AI 推荐不可用（%s），已使用后端 Java 回测策略生成 1 组号码。".formatted(failureDetail.message());
            analysis.put("overview", overview);
            ArrayNode featureSignals = analysis.putArray("featureSignals");
            report.analysisSections().forEach(featureSignals::add);
            ArrayNode combinationLogic = analysis.putArray("combinationLogic");
            combinationLogic.add("从热号、高遗漏、趋势和结构均衡候选中选出单组号码，避免完全依赖单一信号。");
            combinationLogic.add("组内号码按升序展示，并控制区间、奇偶和尾数不要过度集中。");
            ArrayNode warnings = analysis.putArray("riskWarnings");
            if (failureDetail != null) {
                warnings.add("历史 AI 降级原因：" + failureDetail.message());
            }
            warnings.add("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
            warnings.add("Java 规则推荐仅作为娱乐参考。");
            List<String> warningList = new ArrayList<>();
            if (failureDetail != null) {
                warningList.add("历史 AI 降级原因：" + failureDetail.message());
            }
            warningList.add("彩票开奖结果具有独立随机性，历史统计不能保证命中。");
            warningList.add("Java 规则推荐仅作为娱乐参考。");
            return new ValidatedRecommendation(groups, objectMapper.writeValueAsString(root), "低",
                    List.copyOf(warningList));
        } catch (Exception e) {
            throw new IllegalStateException("快乐8规则分析结果序列化失败", e);
        }
    }

    /**
     * 根据历史特征生成 Java 规则推荐（默认选5）。
     *
     * @param report 历史特征报告
     * @return 1 组规则推荐
     */
    public List<LotteryKl8RecommendationGroupVO> fallbackGroups(LotteryKl8FeatureReport report) {
        return fallbackGroups(report, DEFAULT_PICK_SIZE);
    }

    /**
     * 根据历史特征生成 Java 规则推荐。
     *
     * @param report   历史特征报告
     * @param pickSize 每组号码数量（1-10）
     * @return 1 组规则推荐
     */
    public List<LotteryKl8RecommendationGroupVO> fallbackGroups(LotteryKl8FeatureReport report, int pickSize) {
        if (!report.optimizedPortfolio().groups().isEmpty()) {
            return validateGroups(report.optimizedPortfolio().groups().stream()
                    .limit(GROUP_COUNT)
                    .map(group -> new LotteryKl8RecommendationGroupVO(group.numbers(), group.reason()))
                    .toList(), pickSize);
        }
        Random random = new Random(System.nanoTime());
        List<LotteryKl8RecommendationGroupVO> groups = new ArrayList<>();
        Set<String> used = new HashSet<>();
        int cursor = 0;
        List<Integer> candidateNumbers = candidateNumbers(report);
        while (groups.size() < GROUP_COUNT) {
            LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
            // 根据选号数量动态分配候选来源比例
            int hotCount = Math.max(1, pickSize / 4);
            int missingCount = Math.max(1, pickSize / 4);
            int coldCount = Math.max(1, pickSize / 4);
            int candidateCount = pickSize - hotCount - missingCount - coldCount;
            if (candidateCount < 1) {
                candidateCount = 1;
            }
            push(numbers, candidateNumbers, cursor, candidateCount);
            push(numbers, report.hotNumbers(), cursor + 3, hotCount);
            push(numbers, missingCandidates(report), cursor + 5, missingCount);
            push(numbers, report.coldNumbers(), cursor + 7, coldCount);
            while (numbers.size() < pickSize) {
                numbers.add(random.nextInt(80) + 1);
            }
            List<Integer> sorted = numbers.stream().sorted().toList();
            String key = sorted.toString();
            if (used.add(key)) {
                groups.add(new LotteryKl8RecommendationGroupVO(
                        sorted,
                        "Java 规则推荐：结合深度候选池、热号、冷号、遗漏和随机扰动生成，仅作娱乐参考。"));
            }
            cursor += 1;
        }
        return validateGroups(groups, pickSize);
    }

    private List<LotteryKl8RecommendationGroupVO> validateGroups(List<LotteryKl8RecommendationGroupVO> groups, int pickSize) {
        if (groups.size() != GROUP_COUNT) {
            throw new IllegalArgumentException("必须返回 1 组推荐");
        }
        Set<String> used = new HashSet<>();
        List<LotteryKl8RecommendationGroupVO> result = new ArrayList<>();
        for (LotteryKl8RecommendationGroupVO group : groups) {
            LotteryKl8RecommendationGroupVO validated = validateGroup(group.numbers(), group.reason(), pickSize);
            String key = validated.numbers().toString();
            if (!used.add(key)) {
                throw new IllegalArgumentException("推荐组合重复");
            }
            result.add(validated);
        }
        return result;
    }

    private LotteryKl8RecommendationGroupVO validateGroup(List<Integer> numbers, String reason, int pickSize) {
        if (numbers.size() != pickSize) {
            throw new IllegalArgumentException("每组必须 %d 个号码".formatted(pickSize));
        }
        LinkedHashSet<Integer> unique = new LinkedHashSet<>();
        for (Integer number : numbers) {
            if (number == null || number < 1 || number > 80) {
                throw new IllegalArgumentException("号码必须在 1 到 80 之间");
            }
            unique.add(number);
        }
        if (unique.size() != pickSize) {
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
     * @param groups          1 组推荐号码
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
