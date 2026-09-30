package com.lcbinterview.dto.tools;

/**
 * 成本—概率曲线的一行：固定注数下「至少有一注达标」的精确概率与代价。
 * <p>
 * 所有概率均为组合数学精确解（超几何 + 容斥），不含蒙特卡洛误差。
 *
 * @param ticketCount            注数
 * @param coveredNumbers         覆盖的互不重复号码数
 * @param costYuan               投注成本（元）
 * @param atLeastMinHitRate      至少一注命中 minHitLevel 个及以上的概率
 * @param atLeastThreeRate       至少一注中 3 个及以上的概率
 * @param fullHitRate            至少一注全中的概率
 * @param marginalLift           相对上一注的概率提升量（绝对值，0 表示首注）
 * @param costPerPercentPoint    每提升 1 个百分点概率所需成本（元，0 表示首注）
 * @param expectedReturnYuan     期望回报（元），与注数成正比
 * @param payoutRate             返奖率，恒定不随注数变化
 */
public record LotteryKl8CoverageCurveRowVO(
        int ticketCount,
        int coveredNumbers,
        double costYuan,
        double atLeastMinHitRate,
        double atLeastThreeRate,
        double fullHitRate,
        double marginalLift,
        double costPerPercentPoint,
        double expectedReturnYuan,
        double payoutRate
) {
}
