package com.lcbinterview.dto.tools;

/**
 * 目标概率反查的一行：想达到某个「至少中一注」概率，最少要买多少注、花多少钱。
 *
 * @param targetRate       目标概率
 * @param requiredTickets  所需最少注数，0 表示在 80 个号码上限内无法达到
 * @param coveredNumbers   覆盖的互不重复号码数
 * @param costYuan         投注成本（元）
 * @param achievedRate     实际达到的概率（受注数粒度限制，可能高于目标）
 * @param expectedReturnYuan 期望回报（元）
 */
public record LotteryKl8CoverageTargetRowVO(
        double targetRate,
        int requiredTickets,
        int coveredNumbers,
        double costYuan,
        double achievedRate,
        double expectedReturnYuan
) {
}
