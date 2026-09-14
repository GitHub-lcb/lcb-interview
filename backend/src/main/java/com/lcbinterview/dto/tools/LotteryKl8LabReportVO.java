package com.lcbinterview.dto.tools;

import java.util.List;

/**
 * 快乐8 概率实验室报告：理论基线 + 选号配置寻优 + 投注组合实验。
 *
 * @param pickSize                          选号数量
 * @param baseIssueCount                    权重寻优使用的历史期数
 * @param windowSize                        投注组合回放期数
 * @param evaluatedIssueCount               权重寻优实际评估期数
 * @param baselineExpectedHits              理论期望命中数
 * @param baselineAtLeastThreeRate          理论中 2 个及以上概率（字段名沿用历史命名，选4首个有奖级别）
 * @param baselineAtLeastFourRate           理论中 4 个及以上概率
 * @param baselineFullHitRate               理论中 4 个概率（选4全中）
 * @param requiredSampleSizeForOnePointLift 确认 +1 个百分点提升所需的样本量
 * @param variants                          各选号配置的走查前推表现
 * @param portfolios                        投注组合实验结果
 * @param conclusion                        总结论
 * @param disclaimer                        风险提示
 */
public record LotteryKl8LabReportVO(
        int pickSize,
        int baseIssueCount,
        int windowSize,
        int evaluatedIssueCount,
        double baselineExpectedHits,
        double baselineAtLeastThreeRate,
        double baselineAtLeastFourRate,
        double baselineFullHitRate,
        int requiredSampleSizeForOnePointLift,
        List<LotteryKl8LabVariantVO> variants,
        List<LotteryKl8LabPortfolioRowVO> portfolios,
        String conclusion,
        String disclaimer
) {
}
