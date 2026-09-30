package com.lcbinterview.service;

import java.util.List;

/**
 * Jev 校准所需的统计原语。
 *
 * 抽成无状态的纯函数集合，一是让闸门判定逻辑可以被单元测试直接覆盖，
 * 二是让校准服务只负责数据装配，不把统计公式埋在业务流程里。
 *
 * t 临界值与正态近似都采用工程上够用的精度：
 * 自由度超过 30 后用 1.645 近似，误差小于 0.5%，对"放行/不放行"的二元结论没有实质影响。
 */
public final class JevCalibrationStatistics {

    /** 单侧 95% 置信、自由度 1 到 30 的 t 临界值。 */
    private static final double[] T_CRITICAL_95_ONE_SIDED = {
            6.314, 2.920, 2.353, 2.132, 2.015, 1.943, 1.895, 1.860, 1.833, 1.812,
            1.796, 1.782, 1.771, 1.761, 1.753, 1.746, 1.740, 1.734, 1.729, 1.725,
            1.721, 1.717, 1.714, 1.711, 1.708, 1.706, 1.703, 1.701, 1.699, 1.697};

    /** 大样本下单侧 95% 的正态临界值。 */
    private static final double NORMAL_CRITICAL_95_ONE_SIDED = 1.645;

    /** 所需样本量外推的上限，超过该值说明效应小到没有实际检验价值。 */
    private static final int MAX_REQUIRED_ISSUES = 1_000_000;

    private JevCalibrationStatistics() {
    }

    /**
     * 计算均值。
     *
     * @param values 样本，不能为空
     * @return 均值
     */
    public static double mean(List<Double> values) {
        double sum = 0;
        for (double value : values) {
            sum += value;
        }
        return sum / values.size();
    }

    /**
     * 计算样本标准差（分母 n-1）。
     *
     * @param values 样本
     * @param mean   样本均值
     * @return 样本标准差；样本不足 2 个时返回 0
     */
    public static double stdDev(List<Double> values, double mean) {
        if (values.size() < 2) {
            return 0.0;
        }
        double sum = 0;
        for (double value : values) {
            sum += (value - mean) * (value - mean);
        }
        return Math.sqrt(sum / (values.size() - 1));
    }

    /**
     * 单侧 95% 置信的 t 临界值。
     *
     * @param degreesOfFreedom 自由度
     * @return 临界值
     */
    public static double tCriticalOneSided95(int degreesOfFreedom) {
        if (degreesOfFreedom < 1) {
            return T_CRITICAL_95_ONE_SIDED[0];
        }
        if (degreesOfFreedom > T_CRITICAL_95_ONE_SIDED.length) {
            return NORMAL_CRITICAL_95_ONE_SIDED;
        }
        return T_CRITICAL_95_ONE_SIDED[degreesOfFreedom - 1];
    }

    /**
     * 对逐期差值做单侧 95% 配对检验。
     *
     * 原假设为「差值均值 &gt;= 0（Jev 不优于基线）」，备择假设为「差值均值 &lt; 0（Jev 更优）」。
     * 逐期差值之间视为独立，因为开奖期与期之间相互独立；同一期内的 80 个号码存在相关性，
     * 已被聚合进每期一个差值，这一点在报告里也做了提示。
     *
     * @param diffs 逐期差值，负值表示 Jev 更优
     * @return 检验结果
     */
    public static PairedTestResult oneSided95(List<Double> diffs) {
        int count = diffs.size();
        double mean = mean(diffs);
        double stdDev = stdDev(diffs, mean);
        double standardError = count > 1 ? stdDev / Math.sqrt(count) : 0.0;
        double criticalValue = tCriticalOneSided95(count - 1);
        if (standardError <= 0.0) {
            // 差值完全一致：标准误为 0，只有方向能说明问题，不做显著性夸大
            boolean passed = mean < 0;
            return new PairedTestResult(mean, stdDev, 0.0, criticalValue,
                    passed ? Double.NEGATIVE_INFINITY : 0.0, passed ? 0.0 : 1.0, passed);
        }
        double tStatistic = mean / standardError;
        return new PairedTestResult(mean, stdDev, standardError, criticalValue,
                tStatistic, normalCdf(tStatistic), tStatistic <= -criticalValue);
    }

    /**
     * 估算达到显著所需的样本量。
     *
     * 可行条件为 n &gt;= (t(n-1)·sd/|Δ|)²。临界值随自由度增大而减小，
     * 因此右侧随 n 单调递减，f(n) = n − 右侧单调递增，用二分即可找到最小可行 n。
     * 直接用不动点迭代会在两端来回跳，所以这里刻意改用二分。
     *
     * @param meanDiff 当前差值均值，必须为负
     * @param stdDev   当前差值标准差
     * @return 所需期数；方向不对或标准差为 0 时返回 null
     */
    public static Integer requiredIssues(double meanDiff, double stdDev) {
        if (meanDiff >= 0 || stdDev <= 0) {
            return null;
        }
        if (!feasible(MAX_REQUIRED_ISSUES, meanDiff, stdDev)) {
            // 效应过小时不外推到无穷，给出上限让调用方知道样本量需求不现实
            return MAX_REQUIRED_ISSUES;
        }
        int low = 1;
        int high = MAX_REQUIRED_ISSUES;
        while (low < high) {
            int mid = low + (high - low) / 2;
            if (feasible(mid, meanDiff, stdDev)) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return low;
    }

    /**
     * 判断给定样本量是否足以让效应显著。
     *
     * @param issues   样本量
     * @param meanDiff 差值均值
     * @param stdDev   差值标准差
     * @return true 表示该样本量下可达到单侧 95% 显著
     */
    private static boolean feasible(int issues, double meanDiff, double stdDev) {
        double critical = tCriticalOneSided95(issues - 1);
        double ratio = critical * stdDev / Math.abs(meanDiff);
        return (double) issues >= ratio * ratio;
    }

    /**
     * 标准正态累积分布函数。
     *
     * @param z 标准分数
     * @return 累积概率
     */
    public static double normalCdf(double z) {
        if (Double.isInfinite(z)) {
            return z < 0 ? 0.0 : 1.0;
        }
        if (Double.isNaN(z)) {
            return 0.5;
        }
        return 0.5 * (1.0 + erf(z / Math.sqrt(2.0)));
    }

    /**
     * 误差函数近似（Abramowitz &amp; Stegun 7.1.26，最大误差约 1.5e-7）。
     *
     * @param x 自变量
     * @return erf(x)
     */
    public static double erf(double x) {
        double sign = x < 0 ? -1.0 : 1.0;
        double absX = Math.abs(x);
        double t = 1.0 / (1.0 + 0.3275911 * absX);
        double y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t
                + 0.254829592) * t * Math.exp(-absX * absX);
        return sign * y;
    }

    /**
     * 配对检验结果。
     *
     * @param mean          差值均值
     * @param stdDev        差值标准差
     * @param standardError 标准误
     * @param criticalValue 单侧 95% 临界值
     * @param tStatistic    t 统计量
     * @param pValue        单侧 p 值（正态近似）
     * @param passed        是否通过闸门
     */
    public record PairedTestResult(
            double mean,
            double stdDev,
            double standardError,
            double criticalValue,
            double tStatistic,
            double pValue,
            boolean passed
    ) {
    }
}
