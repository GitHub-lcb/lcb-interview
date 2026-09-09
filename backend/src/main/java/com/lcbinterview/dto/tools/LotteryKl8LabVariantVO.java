package com.lcbinterview.dto.tools;

import java.util.Map;

/**
 * 单个选号配置的走查前推表现，附理论基线对比与显著性判定。
 *
 * @param name                配置标识
 * @param label               中文标签
 * @param selected            是否为当期生产配置
 * @param evaluatedIssueCount 评估期数
 * @param averageHitCount     平均命中号码数
 * @param atLeastThreeRate    中 3 个及以上占比
 * @param ciLow               中 3 个及以上占比的 95% 置信区间下限
 * @param ciHigh              中 3 个及以上占比的 95% 置信区间上限
 * @param lift                相对理论基线的绝对提升量
 * @param zScore              相对基线的 z 值
 * @param significant         是否与基线存在统计显著差异
 * @param verdict             判定文案
 * @param hitDistribution     命中数分布
 */
public record LotteryKl8LabVariantVO(
        String name,
        String label,
        boolean selected,
        int evaluatedIssueCount,
        double averageHitCount,
        double atLeastThreeRate,
        double ciLow,
        double ciHigh,
        double lift,
        double zScore,
        boolean significant,
        String verdict,
        Map<Integer, Integer> hitDistribution
) {
}
