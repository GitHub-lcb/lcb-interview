package com.lcbinterview.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 快乐8滚动回测摘要，描述历史策略在已开奖样本中的命中表现。
 *
 * @param evaluatedIssueCount 参与回测的历史转移样本数
 * @param averageHitCount 每组模拟号码的平均命中数
 * @param maxHitCount 单组模拟最高命中数
 * @param hitDistribution 命中数分布，key 为 0 到 pickSize
 * @param factorWeights 走查前推择优后的因子权重
 * @param weightProfileName 择优后的权重配置中文标签
 * @param hitAtLeastThreeRate 中 3 个及以上占比，选5 玩法首个有奖级别的达成率
 * @param topFactorNames 表现较好的因子名称
 * @param profileBacktests 各候选权重配置的横向回测表现，供概率实验室对比
 * @param summary 中文摘要
 */
public record LotteryKl8BacktestSummary(
        int evaluatedIssueCount,
        double averageHitCount,
        int maxHitCount,
        Map<Integer, Integer> hitDistribution,
        LotteryKl8BacktestFactorWeights factorWeights,
        String weightProfileName,
        double hitAtLeastThreeRate,
        List<String> topFactorNames,
        List<LotteryKl8ProfileBacktest> profileBacktests,
        String summary
) {

    /** 默认展示口径：选5 */
    private static final int DEFAULT_PICK_SIZE = 5;

    /**
     * 创建空回测摘要，供历史样本不足或兼容旧调用时使用。
     *
     * @return 空回测摘要
     */
    public static LotteryKl8BacktestSummary empty() {
        return empty(DEFAULT_PICK_SIZE);
    }

    /**
     * 按指定选号数量创建空回测摘要。
     *
     * @param pickSize 每组号码数量，决定命中分布区间
     * @return 空回测摘要
     */
    public static LotteryKl8BacktestSummary empty(int pickSize) {
        return new LotteryKl8BacktestSummary(
                0,
                0,
                0,
                emptyHitDistribution(pickSize),
                LotteryKl8BacktestFactorWeights.neutral(),
                "均衡",
                0,
                List.of(),
                List.of(),
                "历史样本不足，暂未生成滚动回测摘要。");
    }

    private static Map<Integer, Integer> emptyHitDistribution(int pickSize) {
        Map<Integer, Integer> distribution = new LinkedHashMap<>();
        for (int hit = 0; hit <= Math.max(1, pickSize); hit += 1) {
            distribution.put(hit, 0);
        }
        return distribution;
    }
}
