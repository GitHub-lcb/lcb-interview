package com.lcbinterview.service;

/**
 * 北京快乐8 推荐策略校准参数，来自历史推荐命中回填后的滚动统计。
 *
 * @param hotMultiplier     热号和近期活跃信号权重倍率
 * @param coldMultiplier    冷号回补信号权重倍率
 * @param missingMultiplier 高遗漏和长时间未出信号权重倍率
 * @param trendMultiplier   近期上行信号权重倍率
 * @param balanceMultiplier 均衡补位和波动信号权重倍率
 * @param pairMultiplier    对子共现信号权重倍率
 * @param evaluatedCount    本次校准使用的已结算推荐记录数
 * @param summary           可展示给用户和 AI 的校准摘要
 */
public record LotteryKl8StrategyCalibration(
        double hotMultiplier,
        double coldMultiplier,
        double missingMultiplier,
        double trendMultiplier,
        double balanceMultiplier,
        double pairMultiplier,
        int evaluatedCount,
        String summary
) {

    /**
     * 兼容旧调用方的构造器，未提供对子倍率时保持中性权重。
     *
     * @param hotMultiplier     热号和近期活跃信号权重倍率
     * @param coldMultiplier    冷号回补信号权重倍率
     * @param missingMultiplier 高遗漏和长时间未出信号权重倍率
     * @param trendMultiplier   近期上行信号权重倍率
     * @param balanceMultiplier 均衡补位和波动信号权重倍率
     * @param evaluatedCount    本次校准使用的已结算推荐记录数
     * @param summary           可展示给用户和 AI 的校准摘要
     */
    public LotteryKl8StrategyCalibration(
            double hotMultiplier,
            double coldMultiplier,
            double missingMultiplier,
            double trendMultiplier,
            double balanceMultiplier,
            int evaluatedCount,
            String summary) {
        this(hotMultiplier, coldMultiplier, missingMultiplier, trendMultiplier, balanceMultiplier,
                1.0, evaluatedCount, summary);
    }

    /**
     * 返回不改变原始评分公式的中性校准参数。
     *
     * @return 中性校准参数
     */
    public static LotteryKl8StrategyCalibration neutral() {
        return new LotteryKl8StrategyCalibration(
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                0,
                "历史命中反馈不足，暂时使用中性权重");
    }
}
