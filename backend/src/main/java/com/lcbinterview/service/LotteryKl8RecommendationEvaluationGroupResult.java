package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8单组推荐命中结果。
 *
 * @param groupIndex  组序号，从 1 开始
 * @param numbers     推荐号码
 * @param hitNumbers  命中的号码
 * @param hitCount    命中数量
 */
public record LotteryKl8RecommendationEvaluationGroupResult(
        int groupIndex,
        List<Integer> numbers,
        List<Integer> hitNumbers,
        int hitCount
) {
}
