package com.lcbinterview.service;

import java.util.List;

/**
 * Jev 号码概率校准报告，用于判定 Jev 概率是否具备优于随机基线的证据。
 *
 * 判定方法：对最近若干期做走查前推——每期只用该期之前的历史构建特征报告，
 * 让 Jev 推算 80 个号码概率，再与当期实际开奖对比，逐期计算 Brier 分数，
 * 以「Jev Brier − 常数 0.25 基线 Brier」为配对差值做单侧 t 检验。
 *
 * 判读要点：{@code passedGate} 为 false 是正常且预期的结果。
 * 快乐8 单号真实概率恒为 0.25，任何模型都不具备可提取的预测信号；
 * 该报告的作用是把这件事用数字固定下来，阻止「模型信念」被当成「预测能力」上线。
 *
 * @param issuesEvaluated             参与评估的期数
 * @param pairsEvaluated              参与评估的（期, 号码）样本对数量
 * @param baseIssueCount              每期构建特征报告所用的历史期数
 * @param modelVersions               实际参与回答的模型版本集合
 * @param brierJev                    Jev 概率的总体 Brier 分数，越低越好
 * @param brierBaseline               常数 0.25 基线的总体 Brier 分数
 * @param brierDelta                  Jev 与基线的 Brier 差值，负数表示 Jev 更优
 * @param logLossJev                  Jev 概率的对数损失
 * @param meanJevProbability          80 个号码概率的均值，理想情况下应贴近 0.25
 * @param observedHitRate             实际开奖命中率的观测值，理论值 0.25
 * @param meanIssueBrierDiff          逐期 Brier 差值的均值，配对 t 检验的统计对象
 * @param issueBrierDiffStdDev        逐期 Brier 差值的标准差
 * @param tStatistic                  t 统计量
 * @param criticalValue               单侧 95% 置信的临界值
 * @param pValue                      单侧 p 值
 * @param passedGate                  是否通过闸门（Jev 显著优于随机基线）
 * @param requiredIssuesForSignificance 若当前未显著，达到显著所需的最小期数；已显著或方向不对时为 null
 * @param averageLatencyMs            单期平均端到端耗时
 * @param totalInputTokens            总输入 token 数
 * @param verdict                     中文结论
 * @param warnings                    风险提示
 */
public record LotteryKl8JevCalibrationReport(
        int issuesEvaluated,
        int pairsEvaluated,
        int baseIssueCount,
        List<String> modelVersions,
        double brierJev,
        double brierBaseline,
        double brierDelta,
        double logLossJev,
        double meanJevProbability,
        double observedHitRate,
        double meanIssueBrierDiff,
        double issueBrierDiffStdDev,
        double tStatistic,
        double criticalValue,
        double pValue,
        boolean passedGate,
        Integer requiredIssuesForSignificance,
        long averageLatencyMs,
        long totalInputTokens,
        String verdict,
        List<String> warnings
) {
}
