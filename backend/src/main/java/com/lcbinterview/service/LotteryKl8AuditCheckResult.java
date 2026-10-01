package com.lcbinterview.service;

/**
 * 单项随机性检验的结果。
 * <p>
 * 约定：{@code pValue >= 0.05} 表示「未能拒绝随机假设」，即未发现显著偏差；
 * {@code pValue < 0.05} 只说明值得进一步排查，不等于已证明存在偏差。
 *
 * @param name            检验名称
 * @param statistic       检验统计量（卡方为 χ²，游程/自相关/比例为 z 或相关系数）
 * @param degreesOfFreedom 自由度或样本量，具体含义随检验而异
 * @param pValue          p 值
 * @param conclusion      中文结论
 */
public record LotteryKl8AuditCheckResult(
        String name,
        double statistic,
        int degreesOfFreedom,
        double pValue,
        String conclusion
) {

    /**
     * 是否在 5% 水平上显著。用于决定是否需要人工进一步排查。
     *
     * @return p 值小于 0.05 时返回 true
     */
    public boolean significant() {
        return pValue < 0.05;
    }
}
