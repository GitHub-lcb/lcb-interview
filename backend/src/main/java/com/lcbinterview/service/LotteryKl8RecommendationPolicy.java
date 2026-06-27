package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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
            return validateGroups(groups);
        } catch (Exception e) {
            throw new IllegalArgumentException("AI 推荐输出不合规", e);
        }
    }

    /**
     * 根据历史特征生成规则降级推荐。
     *
     * @param report 历史特征报告
     * @return 5 组规则推荐
     */
    public List<LotteryKl8RecommendationGroupVO> fallbackGroups(LotteryKl8FeatureReport report) {
        Random random = new Random(System.nanoTime());
        List<LotteryKl8RecommendationGroupVO> groups = new ArrayList<>();
        Set<String> used = new HashSet<>();
        int cursor = 0;
        while (groups.size() < GROUP_COUNT) {
            LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
            push(numbers, report.hotNumbers(), cursor, 2);
            push(numbers, report.coldNumbers(), cursor + 3, 1);
            push(numbers, missingCandidates(report), cursor + 5, 1);
            while (numbers.size() < GROUP_SIZE) {
                numbers.add(random.nextInt(80) + 1);
            }
            List<Integer> sorted = numbers.stream().sorted().toList();
            String key = sorted.toString();
            if (used.add(key)) {
                groups.add(new LotteryKl8RecommendationGroupVO(
                        sorted,
                        "规则降级推荐：结合热号、冷号、遗漏和随机扰动生成，仅作娱乐参考。"));
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
}
