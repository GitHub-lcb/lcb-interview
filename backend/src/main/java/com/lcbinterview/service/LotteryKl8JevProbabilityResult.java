package com.lcbinterview.service;

import java.util.List;

/**
 * Jev 号码概率推算结果。
 *
 * 记录三件事：模型给出的 80 个号码概率、整体结构风险的量表打分，以及本次调用的事实信息。
 * {@code interpretation} 与 {@code warnings} 是刻意保留的诚实层：
 * 偏差幅度接近抽样噪声时必须明说，不能让前端把「概率」直接渲染成「预测」。
 *
 * @param model                 实际回答的模型版本
 * @param baselineProbability   理论随机基线，恒为 0.25
 * @param numbers               80 个号码的概率推算，按号码升序
 * @param topNumbers            按概率降序取出的前若干个号码
 * @param pickSize              顶层号码数量
 * @param meanProbability       80 个概率的均值，理想情况下应贴近基线
 * @param meanAbsoluteDeviation 概率相对基线的平均绝对偏移
 * @param maxDeviation          最大绝对偏移
 * @param maxDeviationNumber    偏移最大的号码
 * @param overallRiskScore      整体结构风险量表位置，取值落在档位之间
 * @param overallRiskLabel      整体结构风险档位说明，固定取中文文案
 * @param overallRiskConfidence 整体结构风险的置信度，仅表示分布尖锐程度
 * @param legendAligned         Score 回传的档位文字是否与请求定义一一对应
 * @param latencyMs             端到端耗时
 * @param inputTokens           输入 token 数
 * @param outputTokens          输出 token 数
 * @param interpretation        中文解读，明确说明当前偏差是否具备信号意义
 * @param warnings              风险提示
 */
public record LotteryKl8JevProbabilityResult(
        String model,
        double baselineProbability,
        List<LotteryKl8JevNumberProbability> numbers,
        List<Integer> topNumbers,
        int pickSize,
        double meanProbability,
        double impliedDrawnCount,
        double meanAbsoluteDeviation,
        double maxDeviation,
        int maxDeviationNumber,
        int aboveBaselineCount,
        double overallRiskScore,
        String overallRiskLabel,
        double overallRiskConfidence,
        boolean legendAligned,
        long latencyMs,
        long inputTokens,
        long outputTokens,
        String interpretation,
        List<String> warnings
) {

    /** 快乐8每期开出号码数量，由玩法规则决定，是基率守恒判据的基准。 */
    public static final int DRAWN_PER_ISSUE = 20;

    /** 基率守恒的容许偏差，单位为号码个数。 */
    private static final double CONSERVATION_TOLERANCE = 1.0;

    /**
     * 判断这组概率是否对齐了游戏规则。
     *
     * 80 个号码每期只开出 20 个，因此 80 个概率之和在数学上必须等于 20。
     * 这是比任何统计指标都靠前的硬约束：一旦不满足，说明输出连规则都没对齐，
     * 概率数值就不具备绝对含义，只能作同期内部排序参考。
     *
     * @return true 表示概率之和与每期开出号码数的偏差在容许范围内
     */
    public boolean baselineConserved() {
        return Math.abs(impliedDrawnCount - DRAWN_PER_ISSUE) <= CONSERVATION_TOLERANCE;
    }
}
