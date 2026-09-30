package com.lcbinterview.service;

import java.util.Map;

/**
 * Jev System One 一次评估的整体结果。
 *
 * 同一请求里声明的所有问题由服务端并行求解，答案按问题 id 回填。
 *
 * @param answers      问题 id -&gt; 答案
 * @param model        实际回答的模型版本，便于排查别名漂移
 * @param inputTokens  输入 token 数
 * @param outputTokens 输出 token 数
 * @param latencyMs    本地观测到的端到端耗时（毫秒）
 */
public record JevEvaluation(
        Map<String, JevAnswer> answers,
        String model,
        long inputTokens,
        long outputTokens,
        long latencyMs
) {

    /**
     * 按 id 取答案。
     *
     * @param id 问题标识
     * @return 答案，缺失时返回 null
     */
    public JevAnswer answer(String id) {
        return answers.get(id);
    }

    /**
     * 按 id 取 Noul 概率。
     *
     * @param id       问题标识
     * @param fallback 缺失时的退避值
     * @return 0-1 之间的概率
     */
    public double noulProbability(String id, double fallback) {
        JevAnswer answer = answers.get(id);
        if (answer == null || !answer.isNoul()) {
            return fallback;
        }
        return answer.probabilityOr(fallback);
    }

    /**
     * 判断答案集合是否为空。
     *
     * @return true 表示服务端没有返回任何可用答案
     */
    public boolean isEmpty() {
        return answers.isEmpty();
    }
}
