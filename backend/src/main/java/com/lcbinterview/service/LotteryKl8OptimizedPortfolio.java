package com.lcbinterview.service;

import java.util.List;
import java.util.Map;

/**
 * 快乐8组合优化结果，包含 5 组号码和组合层诊断信息。
 *
 * @param groups 5 组优化号码
 * @param summary 组合优化摘要
 * @param diagnostics 组合层诊断信息
 */
public record LotteryKl8OptimizedPortfolio(
        List<LotteryKl8OptimizedGroup> groups,
        String summary,
        Map<String, String> diagnostics
) {

    /**
     * 创建空组合优化结果，供候选池不足或兼容旧调用时使用。
     *
     * @return 空组合优化结果
     */
    public static LotteryKl8OptimizedPortfolio empty() {
        return new LotteryKl8OptimizedPortfolio(List.of(), "候选池不足，暂未生成组合优化结果。", Map.of());
    }
}
