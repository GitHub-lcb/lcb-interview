package com.lcbinterview.service;

import com.lcbinterview.model.LotteryKl8Draw;

import java.util.List;
import java.util.Map;

/**
 * 快乐8历史特征报告。
 *
 * @param baseIssueCount 使用历史期数
 * @param latestIssueNo  最新期号
 * @param hotNumbers     热号
 * @param coldNumbers    冷号
 * @param missingNumbers 遗漏期数
 * @param rangeCounts    区间分布
 * @param tailCounts     尾数分布
 * @param moduloCounts   模 10 分组分布
 * @param oddCount       奇数数量
 * @param evenCount      偶数数量
 * @param draws          原始开奖记录
 * @param numberProfiles 80 个号码画像
 * @param candidatePool  候选号码池
 * @param pairHighlights 高共现号码对
 * @param analysisSections 深度分析分段
 * @param summary        中文摘要
 * @param deepSummary    深度中文摘要
 */
public record LotteryKl8FeatureReport(
        int baseIssueCount,
        String latestIssueNo,
        List<Integer> hotNumbers,
        List<Integer> coldNumbers,
        Map<Integer, Integer> missingNumbers,
        Map<String, Integer> rangeCounts,
        Map<String, Integer> tailCounts,
        Map<String, Integer> moduloCounts,
        int oddCount,
        int evenCount,
        List<LotteryKl8Draw> draws,
        List<LotteryKl8NumberProfile> numberProfiles,
        List<LotteryKl8CandidateNumber> candidatePool,
        List<LotteryKl8PairProfile> pairHighlights,
        List<String> analysisSections,
        String summary,
        String deepSummary
) {

    /**
     * 兼容旧测试和旧调用方的简化构造器。
     *
     * @param baseIssueCount 使用历史期数
     * @param latestIssueNo  最新期号
     * @param hotNumbers     热号
     * @param coldNumbers    冷号
     * @param missingNumbers 遗漏期数
     * @param rangeCounts    区间分布
     * @param oddCount       奇数数量
     * @param evenCount      偶数数量
     * @param draws          原始开奖记录
     * @param summary        中文摘要
     */
    public LotteryKl8FeatureReport(
            int baseIssueCount,
            String latestIssueNo,
            List<Integer> hotNumbers,
            List<Integer> coldNumbers,
            Map<Integer, Integer> missingNumbers,
            Map<String, Integer> rangeCounts,
            int oddCount,
            int evenCount,
            List<LotteryKl8Draw> draws,
            String summary) {
        this(baseIssueCount, latestIssueNo, hotNumbers, coldNumbers, missingNumbers, rangeCounts,
                Map.of(), Map.of(), oddCount, evenCount, draws, List.of(), List.of(), List.of(), List.of(),
                summary, summary);
    }
}
