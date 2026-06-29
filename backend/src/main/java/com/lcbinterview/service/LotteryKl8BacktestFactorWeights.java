package com.lcbinterview.service;

/**
 * 快乐8回测因子权重，值越大表示该因子在近期滚动回测中越应被强调。
 *
 * @param hotWeight 热度因子权重
 * @param missingWeight 遗漏因子权重
 * @param trendWeight 趋势因子权重
 * @param decayWeight 时间衰减热度因子权重
 * @param pairWeight 共现因子权重
 * @param balanceWeight 结构均衡因子权重
 */
public record LotteryKl8BacktestFactorWeights(
        double hotWeight,
        double missingWeight,
        double trendWeight,
        double decayWeight,
        double pairWeight,
        double balanceWeight
) {

    /**
     * 创建中性权重，供历史样本不足或兼容旧调用时使用。
     *
     * @return 中性因子权重
     */
    public static LotteryKl8BacktestFactorWeights neutral() {
        return new LotteryKl8BacktestFactorWeights(1, 1, 1, 1, 1, 1);
    }
}
