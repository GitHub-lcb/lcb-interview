package com.lcbinterview.dto.tools;

/**
 * 投注组合实验的一行结果：每期买 N 注时「至少一注中 3 个及以上」的概率。
 *
 * @param ticketCount       每期注数
 * @param disjointRate      号码不重复拆分的达成率
 * @param disjointCiLow     不重复拆分的 95% 置信区间下限
 * @param disjointCiHigh    不重复拆分的 95% 置信区间上限
 * @param repeatedRate      同一注重复购买 N 次的达成率
 * @param liftOverRepeated  不重复拆分相对重复购买的绝对提升量
 * @param liftOverSingle    不重复拆分相对单注的绝对提升量
 * @param evaluatedIssueCount 回放期数
 */
public record LotteryKl8LabPortfolioRowVO(
        int ticketCount,
        double disjointRate,
        double disjointCiLow,
        double disjointCiHigh,
        double repeatedRate,
        double liftOverRepeated,
        double liftOverSingle,
        int evaluatedIssueCount
) {
}
