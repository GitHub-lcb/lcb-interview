package com.lcbinterview.service;

/**
 * Jev 对单个号码给出的开出概率推算。
 *
 * 快乐8 每期从 80 个号码中开出 20 个，理论基线与号码无关，恒为 20/80 = 0.25。
 * 因此 {@code deviationFromBaseline} 的正负只表示模型信念相对随机基线的偏移方向，
 * 不构成「更可能开出」的证据，必须经校准闸门验证后才能用于排序。
 *
 * @param number               号码，范围 1-80
 * @param probability          Jev 给出的开出概率 0-1
 * @param deviationFromBaseline 相对 0.25 随机基线的偏移
 * @param rank                 按概率降序的排名，1 表示最高
 */
public record LotteryKl8JevNumberProbability(
        int number,
        double probability,
        double deviationFromBaseline,
        int rank
) {
}
