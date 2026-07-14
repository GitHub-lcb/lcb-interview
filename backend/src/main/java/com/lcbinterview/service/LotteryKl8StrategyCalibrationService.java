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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 北京快乐8 策略校准服务，按历史推荐命中反馈动态调整下一次候选评分权重。
 * 支持用户级校准：优先使用当前用户的历史推荐命中数据，样本不足时回退全局。
 * 同时提供单号级别命中反馈，追踪每个号码在历史推荐中的命中率，用于微调综合分。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8StrategyCalibrationService {

    private static final int MAX_EVALUATED_RECOMMENDATIONS = 100;
    /** 用户级校准最少样本数，不足时回退全局 */
    private static final int MIN_USER_EVALUATED = 10;
    private static final double RANDOM_BASELINE = 0.25;
    private static final double PAIR_RANDOM_BASELINE = (20.0 / 80.0) * (19.0 / 79.0);
    private static final double MIN_MULTIPLIER = 0.75;
    private static final double MAX_MULTIPLIER = 1.25;
    /** 单号命中反馈分上下限，避免极端值主导综合分 */
    private static final double FEEDBACK_SCORE_MAX = 0.3;
    private static final double FEEDBACK_SCORE_MIN = -0.3;
    /** 反馈分放大系数，使 ±0.3 的命中率偏差对应 ±4.5 的综合分调整 */
    private static final double FEEDBACK_SCORE_SCALE = 1.2;
    /** 单号反馈置信度满格所需推荐次数 */
    private static final double FEEDBACK_CONFIDENCE_THRESHOLD = 10;

    private final LotteryKl8RecommendationMapper recommendationMapper;
    private final ObjectMapper objectMapper;

    /**
     * 读取最近已结算推荐记录，生成全局策略校准参数。
     *
     * @return 当前策略校准参数；无有效命中反馈时返回中性参数
     */
    @Transactional(readOnly = true)
    public LotteryKl8StrategyCalibration currentCalibration() {
        return currentCalibration(null);
    }

    /**
     * 读取指定用户最近已结算推荐记录，生成用户级策略校准参数。
     * 用户已结算记录不足 {@value #MIN_USER_EVALUATED} 条时回退全局数据。
     *
     * @param userId 用户 ID，null 表示查询全局
     * @return 当前策略校准参数；无有效命中反馈时返回中性参数
     */
    @Transactional(readOnly = true)
    public LotteryKl8StrategyCalibration currentCalibration(Long userId) {
        List<LotteryKl8Recommendation> recommendations = loadEvaluatedRecommendations(userId);
        if (recommendations.size() < MIN_USER_EVALUATED && userId != null) {
            // 用户自身样本不足，回退全局
            recommendations = loadEvaluatedRecommendations(null);
        }
        return computeCalibration(recommendations);
    }

    /**
     * 计算指定用户的单号级别命中反馈分。
     * 用户已结算记录不足 {@value #MIN_USER_EVALUATED} 条时回退全局数据。
     *
     * @param userId 用户 ID，null 表示查询全局
     * @return 号码 → 反馈分映射，分值范围 [-0.3, +0.3]，空映射表示无有效反馈
     */
    @Transactional(readOnly = true)
    public Map<Integer, Double> numberHitFeedback(Long userId) {
        List<LotteryKl8Recommendation> recommendations = loadEvaluatedRecommendations(userId);
        if (recommendations.size() < MIN_USER_EVALUATED && userId != null) {
            recommendations = loadEvaluatedRecommendations(null);
        }
        return computeNumberHitFeedback(recommendations);
    }

    /**
     * 查询已结算推荐记录，按用户过滤或全局查询。
     *
     * @param userId 用户 ID，null 表示全局
     * @return 已结算推荐列表，按结算时间倒序
     */
    private List<LotteryKl8Recommendation> loadEvaluatedRecommendations(Long userId) {
        var query = Wrappers.<LotteryKl8Recommendation>lambdaQuery()
                .isNotNull(LotteryKl8Recommendation::getEvaluatedAt)
                .isNotNull(LotteryKl8Recommendation::getHitSummaryJson)
                .ne(LotteryKl8Recommendation::getHitSummaryJson, "")
                .orderByDesc(LotteryKl8Recommendation::getEvaluatedAt)
                .last("LIMIT " + MAX_EVALUATED_RECOMMENDATIONS);
        if (userId != null) {
            query.eq(LotteryKl8Recommendation::getUserId, userId);
        }
        return recommendationMapper.selectList(query);
    }

    /**
     * 从已结算推荐记录计算角色级策略校准参数。
     *
     * @param recommendations 已结算推荐列表
     * @return 策略校准参数
     */
    private LotteryKl8StrategyCalibration computeCalibration(List<LotteryKl8Recommendation> recommendations) {
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
        double pair = multiplier(stats.get(RoleBucket.PAIR), PAIR_RANDOM_BASELINE);
        String summary = "历史命中反馈校准：使用最近 %d 条已结算推荐，热号 %.2f、冷号 %.2f、高遗漏 %.2f、趋势 %.2f、均衡 %.2f、对子 %.2f；随机基线按单号 25%%、对子双中 %.2f%% 计算，倍率仅用于下一次统计参考。"
                .formatted(evaluatedCount, hot, cold, missing, trend, balance, pair, PAIR_RANDOM_BASELINE * 100);
        return new LotteryKl8StrategyCalibration(hot, cold, missing, trend, balance, pair, evaluatedCount, summary);
    }

    /**
     * 从已结算推荐记录计算单号级别命中反馈分。
     * 遍历每条推荐的命中结果，统计每个号码被推荐次数和命中次数，
     * 用命中率相对 25% 随机基线的偏差生成反馈分，并按样本量做置信度衰减。
     *
     * @param recommendations 已结算推荐列表
     * @return 号码 → 反馈分映射，空映射表示无有效数据
     */
    private Map<Integer, Double> computeNumberHitFeedback(List<LotteryKl8Recommendation> recommendations) {
        if (recommendations.isEmpty()) {
            return Map.of();
        }
        // number → [recommendedCount, hitCount]
        Map<Integer, int[]> numberStats = new HashMap<>();
        for (LotteryKl8Recommendation recommendation : recommendations) {
            try {
                JsonNode root = objectMapper.readTree(recommendation.getHitSummaryJson());
                JsonNode groups = root.path("groups");
                if (!groups.isArray() || groups.isEmpty()) {
                    continue;
                }
                for (JsonNode group : groups) {
                    Set<Integer> hitSet = new HashSet<>();
                    JsonNode hitNumbers = group.path("hitNumbers");
                    if (hitNumbers.isArray()) {
                        for (JsonNode node : hitNumbers) {
                            hitSet.add(node.asInt());
                        }
                    }
                    JsonNode numbers = group.path("numbers");
                    if (!numbers.isArray()) {
                        continue;
                    }
                    for (JsonNode numberNode : numbers) {
                        int number = numberNode.asInt();
                        int[] stats = numberStats.computeIfAbsent(number, ignored -> new int[2]);
                        stats[0] += 1;
                        if (hitSet.contains(number)) {
                            stats[1] += 1;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("快乐8单号反馈跳过异常记录: recommendationId={}, error={}", recommendation.getId(), e.getMessage());
            }
        }
        if (numberStats.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Double> feedback = new LinkedHashMap<>();
        for (Map.Entry<Integer, int[]> entry : numberStats.entrySet()) {
            int number = entry.getKey();
            int recommended = entry.getValue()[0];
            int hit = entry.getValue()[1];
            if (recommended == 0) {
                continue;
            }
            double hitRate = (double) hit / recommended;
            // 置信度：推荐次数达到阈值后满格，不足时线性增长，避免小样本过拟合
            double confidence = Math.min(1.0, (double) recommended / FEEDBACK_CONFIDENCE_THRESHOLD);
            // 反馈分：命中率偏离随机基线的程度，裁剪到 [-0.3, +0.3] 后乘以置信度
            double rawScore = Math.max(FEEDBACK_SCORE_MIN,
                    Math.min(FEEDBACK_SCORE_MAX, (hitRate - RANDOM_BASELINE) * FEEDBACK_SCORE_SCALE));
            feedback.put(number, round(rawScore * confidence));
        }
        return feedback;
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
        applyPairResults(root.path("pairs"), stats.get(RoleBucket.PAIR));
        return true;
    }

    private void applyPairResults(JsonNode pairs, RoleStats pairStats) {
        if (!pairs.isArray()) {
            return;
        }
        for (JsonNode pair : pairs) {
            pairStats.appearance += 1;
            if (pair.path("fullHit").asBoolean(false) || pair.path("hitCount").asInt(0) >= 2) {
                pairStats.hit += 1;
            }
        }
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
        return multiplier(stats, RANDOM_BASELINE);
    }

    private double multiplier(RoleStats stats, double baseline) {
        if (stats.appearance == 0) {
            return 1.0;
        }
        double hitRate = (double) stats.hit / stats.appearance;
        return round(Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, 1 + hitRate - baseline)));
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private enum RoleBucket {
        HOT,
        COLD,
        MISSING,
        TREND,
        BALANCE,
        PAIR
    }

    private static class RoleStats {

        private int appearance;
        private int hit;
    }
}
