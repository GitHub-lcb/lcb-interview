package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.LotteryKl8Recommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 北京快乐8 策略校准服务，按历史推荐命中反馈动态调整下一次候选评分权重。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8StrategyCalibrationService {

    private static final int MAX_EVALUATED_RECOMMENDATIONS = 100;
    private static final double RANDOM_BASELINE = 0.25;
    private static final double MIN_MULTIPLIER = 0.75;
    private static final double MAX_MULTIPLIER = 1.25;

    private final LotteryKl8RecommendationMapper recommendationMapper;
    private final ObjectMapper objectMapper;

    /**
     * 读取最近已结算推荐记录，生成当前策略校准参数。
     *
     * @return 当前策略校准参数；无有效命中反馈时返回中性参数
     */
    @Transactional(readOnly = true)
    public LotteryKl8StrategyCalibration currentCalibration() {
        List<LotteryKl8Recommendation> recommendations = recommendationMapper.selectList(
                Wrappers.<LotteryKl8Recommendation>lambdaQuery()
                        .isNotNull(LotteryKl8Recommendation::getEvaluatedAt)
                        .isNotNull(LotteryKl8Recommendation::getHitSummaryJson)
                        .ne(LotteryKl8Recommendation::getHitSummaryJson, "")
                        .orderByDesc(LotteryKl8Recommendation::getEvaluatedAt)
                        .last("LIMIT " + MAX_EVALUATED_RECOMMENDATIONS));
        if (recommendations.isEmpty()) {
            return LotteryKl8StrategyCalibration.neutral();
        }

        EnumMap<RoleBucket, RoleStats> stats = new EnumMap<>(RoleBucket.class);
        for (RoleBucket bucket : RoleBucket.values()) {
            stats.put(bucket, new RoleStats());
        }

        int evaluatedCount = 0;
        for (LotteryKl8Recommendation recommendation : recommendations) {
            try {
                if (applyRecommendation(recommendation, stats)) {
                    evaluatedCount += 1;
                }
            } catch (Exception e) {
                log.warn("快乐8策略校准跳过异常记录: recommendationId={}, error={}", recommendation.getId(), e.getMessage());
            }
        }
        if (evaluatedCount == 0) {
            return LotteryKl8StrategyCalibration.neutral();
        }

        double hot = multiplier(stats.get(RoleBucket.HOT));
        double cold = multiplier(stats.get(RoleBucket.COLD));
        double missing = multiplier(stats.get(RoleBucket.MISSING));
        double trend = multiplier(stats.get(RoleBucket.TREND));
        double balance = multiplier(stats.get(RoleBucket.BALANCE));
        String summary = "历史命中反馈校准：使用最近 %d 条已结算推荐，热号 %.2f、冷号 %.2f、高遗漏 %.2f、趋势 %.2f、均衡 %.2f；随机基线按单号 25%% 计算，倍率仅用于下一次统计参考。"
                .formatted(evaluatedCount, hot, cold, missing, trend, balance);
        return new LotteryKl8StrategyCalibration(hot, cold, missing, trend, balance, evaluatedCount, summary);
    }

    private boolean applyRecommendation(
            LotteryKl8Recommendation recommendation,
            EnumMap<RoleBucket, RoleStats> stats) throws Exception {
        Map<Integer, List<RoleBucket>> roleMap = roleMap(recommendation.getCandidatePoolJson());
        JsonNode root = objectMapper.readTree(recommendation.getHitSummaryJson());
        JsonNode groups = root.path("groups");
        if (!groups.isArray() || groups.isEmpty()) {
            return false;
        }
        for (JsonNode group : groups) {
            Map<Integer, Boolean> hits = hitMap(group.path("hitNumbers"));
            JsonNode numbers = group.path("numbers");
            if (!numbers.isArray()) {
                continue;
            }
            for (JsonNode numberNode : numbers) {
                int number = numberNode.asInt();
                List<RoleBucket> buckets = roleMap.getOrDefault(number, List.of(RoleBucket.BALANCE));
                for (RoleBucket bucket : buckets) {
                    stats.get(bucket).appearance += 1;
                    if (hits.containsKey(number)) {
                        stats.get(bucket).hit += 1;
                    }
                }
            }
        }
        return true;
    }

    private Map<Integer, List<RoleBucket>> roleMap(String candidatePoolJson) throws Exception {
        Map<Integer, List<RoleBucket>> roleMap = new HashMap<>();
        if (candidatePoolJson == null || candidatePoolJson.isBlank()) {
            return roleMap;
        }
        JsonNode candidates = objectMapper.readTree(candidatePoolJson);
        if (!candidates.isArray()) {
            return roleMap;
        }
        for (JsonNode candidate : candidates) {
            int number = candidate.path("number").asInt(0);
            if (number <= 0) {
                continue;
            }
            List<RoleBucket> buckets = new ArrayList<>();
            JsonNode roles = candidate.path("roles");
            if (roles.isArray()) {
                for (JsonNode role : roles) {
                    RoleBucket bucket = bucket(role.asText(""));
                    if (!buckets.contains(bucket)) {
                        buckets.add(bucket);
                    }
                }
            }
            if (buckets.isEmpty()) {
                buckets.add(RoleBucket.BALANCE);
            }
            roleMap.put(number, buckets);
        }
        return roleMap;
    }

    private Map<Integer, Boolean> hitMap(JsonNode hitNumbers) {
        Map<Integer, Boolean> hits = new HashMap<>();
        if (!hitNumbers.isArray()) {
            return hits;
        }
        for (JsonNode number : hitNumbers) {
            hits.put(number.asInt(), true);
        }
        return hits;
    }

    private RoleBucket bucket(String role) {
        if (role.contains("热") || role.contains("活跃")) {
            return RoleBucket.HOT;
        }
        if (role.contains("冷")) {
            return RoleBucket.COLD;
        }
        if (role.contains("遗漏") || role.contains("未出")) {
            return RoleBucket.MISSING;
        }
        if (role.contains("上行") || role.contains("趋势")) {
            return RoleBucket.TREND;
        }
        return RoleBucket.BALANCE;
    }

    private double multiplier(RoleStats stats) {
        if (stats.appearance == 0) {
            return 1.0;
        }
        double hitRate = (double) stats.hit / stats.appearance;
        return round(Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, 1 + hitRate - RANDOM_BASELINE)));
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private enum RoleBucket {
        HOT,
        COLD,
        MISSING,
        TREND,
        BALANCE
    }

    private static class RoleStats {

        private int appearance;
        private int hit;
    }
}
