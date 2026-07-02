package com.lcbinterview.service;

import java.util.List;
import java.util.Map;

/**
 * 快乐8组合优化结果，包含 Java 精选号码组和组合层诊断信息。
 *
 * @param groups 优化号码组，当前只生成 1 组
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
