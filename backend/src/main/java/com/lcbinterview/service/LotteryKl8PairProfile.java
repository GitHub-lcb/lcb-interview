package com.lcbinterview.service;

/**
 * 快乐8号码共现对画像。
 *
 * @param leftNumber  较小号码
 * @param rightNumber 较大号码
 * @param count       基准期内共现次数
 * @param lift        相对独立出现的提升度
 * @param score       共现综合分
 */
public record LotteryKl8PairProfile(
        int leftNumber,
        int rightNumber,
        int count,
        double lift,
        double score
) {
}
