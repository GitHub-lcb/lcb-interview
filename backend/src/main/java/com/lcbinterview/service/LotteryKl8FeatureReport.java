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
 * @param oddCount       奇数数量
 * @param evenCount      偶数数量
 * @param draws          原始开奖记录
 * @param summary        中文摘要
 */
public record LotteryKl8FeatureReport(
        int baseIssueCount,
        String latestIssueNo,
        List<Integer> hotNumbers,
        List<Integer> coldNumbers,
        Map<Integer, Integer> missingNumbers,
        Map<String, Integer> rangeCounts,
        int oddCount,
        int evenCount,
        List<LotteryKl8Draw> draws,
        String summary
) {
}
