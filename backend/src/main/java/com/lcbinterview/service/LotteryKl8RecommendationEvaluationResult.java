package com.lcbinterview.service;

import java.time.LocalDate;
import java.util.List;

/**
 * 快乐8推荐命中结算结果。
 *
 * @param issueNo       用于结算的开奖期号
 * @param drawDate      开奖日期
 * @param drawNumbers   开奖号码
 * @param totalHitCount 5 组累计命中数量
 * @param maxHitCount   单组最高命中数量
 * @param groups        分组命中结果
 */
public record LotteryKl8RecommendationEvaluationResult(
        String issueNo,
        LocalDate drawDate,
        List<Integer> drawNumbers,
        int totalHitCount,
        int maxHitCount,
        List<LotteryKl8RecommendationEvaluationGroupResult> groups
) {
}
