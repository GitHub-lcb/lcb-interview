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
 * @param factorWeights 基于回测表现得到的因子权重
 * @param topFactorNames 表现较好的因子名称
 * @param summary 中文摘要
 */
public record LotteryKl8BacktestSummary(
        int evaluatedIssueCount,
        double averageHitCount,
        int maxHitCount,
        Map<Integer, Integer> hitDistribution,
        LotteryKl8BacktestFactorWeights factorWeights,
        List<String> topFactorNames,
        String summary
) {

    /**
     * 创建空回测摘要，供历史样本不足或兼容旧调用时使用。
     *
     * @return 空回测摘要
     */
    public static LotteryKl8BacktestSummary empty() {
        return new LotteryKl8BacktestSummary(
                0,
                0,
                0,
                emptyHitDistribution(),
                LotteryKl8BacktestFactorWeights.neutral(),
                List.of(),
                "历史样本不足，暂未生成滚动回测摘要。");
    }

    private static Map<Integer, Integer> emptyHitDistribution() {
        Map<Integer, Integer> distribution = new LinkedHashMap<>();
        for (int hit = 0; hit <= 5; hit += 1) {
            distribution.put(hit, 0);
        }
        return distribution;
    }
}
