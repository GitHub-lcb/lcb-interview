package com.lcbinterview.dto.tools;

import java.util.List;

/**
 * 快乐8 覆盖优化报告：把「花多少钱能买到多少中奖概率」变成可计算的曲线。
 * <p>
 * 这是快乐8 上唯一有真实统计收益的方向。核心结论是组合数学而非预测：
 * 单注概率由超几何分布锁死，注数固定时「至少一注达标」的概率只取决于
 * 覆盖了多少个互不重复的号码，与「哪几个号凑成一注」完全无关。
 * 因此「买更多互不重复的号」是理论最优解，选号策略的贡献恒为 0。
 *
 * @param pickSize                 每注选号数量
 * @param minHitLevel              达标口径（至少命中几个）
 * @param ticketPriceYuan          单注票价（元）
 * @param maxDisjointTickets       号码池能容纳的最多互不重复注数
 * @param singleTicketRate         单注达标概率（数学常量，任何策略都改不了）
 * @param expectedReturnPerTicket  单注期望回报（元）
 * @param payoutRate               返奖率，恒定不随注数变化
 * @param netLossPerTicketYuan     单注期望亏损（元）
 * @param curve                    成本—概率曲线
 * @param targets                  目标概率反查结果
 * @param bestValueTicketCount     单位成本概率提升最大的注数
 * @param bestValueCostPerPercentPoint 该注数下每提升 1 个百分点概率的成本（元）
 * @param budgetYuan               预算上限（元），未提供时为 0
 * @param budgetAchievableRate     预算内可达到的最高概率
 * @param budgetTicketCount        预算内可买的注数
 * @param conclusion               结论
 * @param disclaimer               风险提示
 */
public record LotteryKl8CoverageReportVO(
        int pickSize,
        int minHitLevel,
        double ticketPriceYuan,
        int maxDisjointTickets,
        double singleTicketRate,
        double expectedReturnPerTicket,
        double payoutRate,
        double netLossPerTicketYuan,
        List<LotteryKl8CoverageCurveRowVO> curve,
        List<LotteryKl8CoverageTargetRowVO> targets,
        int bestValueTicketCount,
        double bestValueCostPerPercentPoint,
        double budgetYuan,
        int budgetTicketCount,
        double budgetAchievableRate,
        String conclusion,
        String disclaimer
) {
}
