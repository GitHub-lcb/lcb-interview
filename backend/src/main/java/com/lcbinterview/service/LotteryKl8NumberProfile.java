package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8单个号码的深度历史画像，用于候选池排序和 AI 结构化输入。
 *
 * @param number                 号码，范围 1-80
 * @param frequency              基准期内出现次数
 * @param frequencyRate          基准期内出现率
 * @param recent30Frequency      最近 30 期出现次数
 * @param recent60Frequency      最近 60 期出现次数
 * @param recent120Frequency     最近 120 期出现次数
 * @param recent365Frequency     最近 365 期出现次数
 * @param currentMissing         当前遗漏期数
 * @param averageMissing         平均遗漏期数
 * @param maxMissing             最大遗漏期数
 * @param trendScore             近期趋势分，正数表示近 30 期强于前 30 期
 * @param volatility             分段波动程度
 * @param decayedFrequencyScore  按时间衰减后的近期热度分
 * @param omissionPressureScore  当前遗漏相对历史平均遗漏的压力分
 * @param rangeLabel             所属区间
 * @param parity                 奇偶属性
 * @param tail                   尾数
 * @param modulo10               模 10 分组
 * @param compositeScore         综合候选分
 * @param tags                   号码标签
 */
public record LotteryKl8NumberProfile(
        int number,
        int frequency,
        double frequencyRate,
        int recent30Frequency,
        int recent60Frequency,
        int recent120Frequency,
        int recent365Frequency,
        int currentMissing,
        double averageMissing,
        int maxMissing,
        double trendScore,
        double volatility,
        double decayedFrequencyScore,
        double omissionPressureScore,
        String rangeLabel,
        String parity,
        int tail,
        int modulo10,
        double compositeScore,
        List<String> tags
) {
}
