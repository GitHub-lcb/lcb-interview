package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import com.lcbinterview.model.LotteryKl8Recommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 快乐8推荐命中结算服务，基于下一期开奖回填历史推荐表现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8RecommendationEvaluationService {

    private static final int MAX_PENDING_EVALUATION = 200;

    private final LotteryKl8RecommendationMapper recommendationMapper;
    private final LotteryKl8DrawMapper drawMapper;
    private final ObjectMapper objectMapper;

    /**
     * 批量结算尚未回填命中结果的推荐记录。
     *
     * @return 本次结算记录数
     */
    @Transactional
    public int evaluatePendingRecommendations() {
        List<LotteryKl8Recommendation> pending = recommendationMapper.selectList(
                Wrappers.<LotteryKl8Recommendation>lambdaQuery()
                        .and(wrapper -> wrapper
                                .isNull(LotteryKl8Recommendation::getEvaluatedIssueNo)
                                .or()
                                .eq(LotteryKl8Recommendation::getEvaluatedIssueNo, ""))
                        .isNotNull(LotteryKl8Recommendation::getLatestIssueNo)
                        .orderByAsc(LotteryKl8Recommendation::getCreateTime)
                        .last("LIMIT " + MAX_PENDING_EVALUATION));
        int evaluated = 0;
        for (LotteryKl8Recommendation recommendation : pending) {
            LotteryKl8Draw nextDraw = nextDraw(recommendation.getLatestIssueNo());
            if (nextDraw == null) {
                continue;
            }
            try {
                evaluateRecommendation(recommendation, nextDraw);
                evaluated += 1;
            } catch (Exception e) {
                log.warn("快乐8推荐命中结算失败: recommendationId={}, error={}", recommendation.getId(), e.getMessage());
            }
        }
        return evaluated;
    }

    /**
     * 使用指定期开奖结算单条推荐记录，并写回数据库。
     *
     * @param recommendation 推荐记录
     * @param draw           开奖记录
     * @return 命中结算结果
     */
    public LotteryKl8RecommendationEvaluationResult evaluateRecommendation(
            LotteryKl8Recommendation recommendation,
            LotteryKl8Draw draw) {
        List<Integer> drawNumbers = parseNumbers(draw.getNumbers());
        Set<Integer> drawSet = new LinkedHashSet<>(drawNumbers);
        List<LotteryKl8RecommendationGroupVO> groups = parseGroups(recommendation.getRecommendationsJson());
        List<LotteryKl8RecommendationEvaluationGroupResult> groupResults = new ArrayList<>();
        List<PairEvaluationResult> pairResults = evaluatePairs(
                parseSelectedPairs(recommendation.getAnalysisJson()), drawSet);
        int totalHitCount = 0;
        int maxHitCount = 0;
        for (int index = 0; index < groups.size(); index += 1) {
            List<Integer> numbers = groups.get(index).numbers();
            List<Integer> hitNumbers = numbers.stream()
                    .filter(drawSet::contains)
                    .sorted()
                    .toList();
            int hitCount = hitNumbers.size();
            totalHitCount += hitCount;
            maxHitCount = Math.max(maxHitCount, hitCount);
            groupResults.add(new LotteryKl8RecommendationEvaluationGroupResult(index + 1, numbers, hitNumbers, hitCount));
        }
        LotteryKl8RecommendationEvaluationResult result = new LotteryKl8RecommendationEvaluationResult(
                draw.getIssueNo(),
                draw.getDrawDate(),
                drawNumbers,
                totalHitCount,
                maxHitCount,
                groupResults);
        recommendation.setEvaluatedIssueNo(draw.getIssueNo());
        recommendation.setEvaluatedDrawDate(draw.getDrawDate());
        recommendation.setHitSummaryJson(writeResult(result, pairResults));
        recommendation.setTotalHitCount(totalHitCount);
        recommendation.setMaxHitCount(maxHitCount);
        recommendation.setEvaluatedAt(LocalDateTime.now());
        recommendationMapper.updateById(recommendation);
        return result;
    }

    private LotteryKl8Draw nextDraw(String latestIssueNo) {
        if (latestIssueNo == null || latestIssueNo.isBlank()) {
            return null;
        }
        return drawMapper.selectOne(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .gt(LotteryKl8Draw::getIssueNo, latestIssueNo)
                .orderByAsc(LotteryKl8Draw::getDrawDate)
                .orderByAsc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT 1"));
    }

    private List<LotteryKl8RecommendationGroupVO> parseGroups(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            throw new IllegalArgumentException("快乐8推荐号码 JSON 解析失败", e);
        }
    }

    private List<RecommendedPair> parseSelectedPairs(String analysisJson) {
        if (analysisJson == null || analysisJson.isBlank()) {
            return List.of();
        }
        try {
            JsonNode pairs = objectMapper.readTree(analysisJson)
                    .path("optimizedPortfolio")
                    .path("pairRecommendations");
            if (!pairs.isArray()) {
                return List.of();
            }
            List<RecommendedPair> result = new ArrayList<>();
            for (JsonNode pair : pairs) {
                if (!pair.path("selected").asBoolean(false)) {
                    continue;
                }
                int left = pair.path("leftNumber").asInt(0);
                int right = pair.path("rightNumber").asInt(0);
                if (left > 0 && right > 0 && left != right) {
                    result.add(new RecommendedPair(Math.min(left, right), Math.max(left, right)));
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("快乐8推荐对子 JSON 解析失败: error={}", e.getMessage());
            return List.of();
        }
    }

    private List<PairEvaluationResult> evaluatePairs(List<RecommendedPair> pairs, Set<Integer> drawSet) {
        List<PairEvaluationResult> result = new ArrayList<>();
        for (int index = 0; index < pairs.size(); index += 1) {
            RecommendedPair pair = pairs.get(index);
            List<Integer> numbers = List.of(pair.leftNumber(), pair.rightNumber());
            List<Integer> hitNumbers = numbers.stream()
                    .filter(drawSet::contains)
                    .toList();
            result.add(new PairEvaluationResult(index + 1, numbers, hitNumbers, hitNumbers.size(), hitNumbers.size() == 2));
        }
        return result;
    }

    private String writeResult(LotteryKl8RecommendationEvaluationResult result, List<PairEvaluationResult> pairResults) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("issueNo", result.issueNo());
        root.put("drawDate", result.drawDate() == null ? "" : result.drawDate().toString());
        ArrayNode drawNumbers = root.putArray("drawNumbers");
        result.drawNumbers().forEach(drawNumbers::add);
        root.put("totalHitCount", result.totalHitCount());
        root.put("maxHitCount", result.maxHitCount());
        ArrayNode pairs = root.putArray("pairs");
        for (PairEvaluationResult pair : pairResults) {
            ObjectNode pairNode = pairs.addObject();
            pairNode.put("pairIndex", pair.pairIndex());
            ArrayNode numbers = pairNode.putArray("numbers");
            pair.numbers().forEach(numbers::add);
            ArrayNode hitNumbers = pairNode.putArray("hitNumbers");
            pair.hitNumbers().forEach(hitNumbers::add);
            pairNode.put("hitCount", pair.hitCount());
            pairNode.put("fullHit", pair.fullHit());
        }
        ArrayNode groups = root.putArray("groups");
        for (LotteryKl8RecommendationEvaluationGroupResult group : result.groups()) {
            ObjectNode groupNode = groups.addObject();
            groupNode.put("groupIndex", group.groupIndex());
            ArrayNode numbers = groupNode.putArray("numbers");
            group.numbers().forEach(numbers::add);
            ArrayNode hitNumbers = groupNode.putArray("hitNumbers");
            group.hitNumbers().forEach(hitNumbers::add);
            groupNode.put("hitCount", group.hitCount());
        }
        return root.toString();
    }

    private record RecommendedPair(int leftNumber, int rightNumber) {
    }

    private record PairEvaluationResult(
            int pairIndex,
            List<Integer> numbers,
            List<Integer> hitNumbers,
            int hitCount,
            boolean fullHit
    ) {
    }

    private List<Integer> parseNumbers(String numbers) {
        if (numbers == null || numbers.isBlank()) {
            return List.of();
        }
        List<Integer> result = new ArrayList<>();
        for (String part : numbers.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isBlank()) {
                result.add(Integer.parseInt(trimmed));
            }
        }
        return result;
    }
}
