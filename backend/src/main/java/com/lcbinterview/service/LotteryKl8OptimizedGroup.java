package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8组合优化后的单组推荐，保存组合分、选号原因和可解释证据。
 *
 * @param numbers 5 个推荐号码，升序展示
 * @param score 组合优化分
 * @param reason 推荐原因
 * @param evidence 组合证据
 */
public record LotteryKl8OptimizedGroup(
        List<Integer> numbers,
        double score,
        String reason,
        List<String> evidence
) {
}
