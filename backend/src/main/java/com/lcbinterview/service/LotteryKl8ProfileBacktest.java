package com.lcbinterview.service;

import java.util.Map;

/**
 * 单个因子权重配置的走查前推回测表现。
 * <p>
 * 概率实验室用它横向比较各候选配置：同一批历史、同一套选号函数，
 * 只有权重不同，因此差异可以直接归因到权重本身。
 *
 * @param name                配置标识
 * @param label               中文标签
 * @param evaluatedIssueCount 参与评估的期数
 * @param averageHitCount     平均命中号码数
 * @param hitDistribution     命中数分布，key 为 0 到 pickSize
 * @param atLeastThreeRate    中 2 个及以上占比（选4 的首个有奖级别，字段名沿用历史命名）
 * @param selected            是否被选为当期生产配置
 */
public record LotteryKl8ProfileBacktest(
        String name,
        String label,
        int evaluatedIssueCount,
        double averageHitCount,
        Map<Integer, Integer> hitDistribution,
        double atLeastThreeRate,
        boolean selected
) {
}
