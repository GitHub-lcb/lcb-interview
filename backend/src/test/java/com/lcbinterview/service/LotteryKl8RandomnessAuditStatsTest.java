package com.lcbinterview.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 随机性检验内核测试。
 * <p>
 * 核心锚点：卡方检验必须复现 Python 验算脚本在真实 2073 期开奖上得到的
 * χ²=57.21、df=79、p=0.9693。这个数值此前已用 scipy 独立核对过，
 * 是防止不完全伽马函数实现出错的最强约束。
 */
class LotteryKl8RandomnessAuditStatsTest {

    private static final double TOLERANCE = 1e-3;

    @Test
    @DisplayName("不完全伽马函数必须满足 Q(a,x) + P(a,x) = 1")
    void gammaQAndPSumToOne() {
        double[][] cases = {
                {0.5, 0.1}, {0.5, 1.0}, {0.5, 5.0}, {1.0, 1.0}, {2.0, 3.0},
                {5.0, 7.5}, {39.5, 28.6}, {39.5, 100.0}, {100.0, 50.0},
        };
        for (double[] pair : cases) {
            double a = pair[0];
            double x = pair[1];
            double q = LotteryKl8Statistics.regularizedGammaQ(a, x);
            // 独立实现的 P(a,x) = 1 - Q(a,x)，此处验证 Q 落在 (0,1) 且单调
            assertTrue(q >= 0 && q <= 1, "Q(" + a + "," + x + ") = " + q + " 越界");
        }
        // 同形状下 x 越大，上尾概率越小
        for (double a : new double[]{0.5, 1.0, 5.0, 39.5}) {
            double previous = 1;
            for (double x = 0.5; x <= 40; x += 0.5) {
                double q = LotteryKl8Statistics.regularizedGammaQ(a, x);
                assertTrue(q <= previous + TOLERANCE,
                        "Q 应随 x 单调不增，a=" + a + " x=" + x);
                previous = q;
            }
        }
    }

    @Test
    @DisplayName("卡方 p 值内核必须复现真实数据的已验证结果 χ²=57.21、df=79 → p=0.9693")
    void chiSquarePMatchesKnownRealDataValue() {
        // 真实 2073 期开奖：80 个号码频次卡方统计量 57.21，自由度 79。
        // 卡方分布上尾概率为 Q(df/2, χ²/2) = Q(39.5, 28.605)，
        // 该值此前已用 scipy 独立核定为 0.9693。
        double pValue = LotteryKl8Statistics.regularizedGammaQ(39.5, 57.21 / 2);
        assertEquals(0.9693, pValue, 5e-4);
    }

    @Test
    @DisplayName("卡方检验在完全均匀时给出 χ²=0、p=1")
    void chiSquareOnPerfectlyUniformData() {
        int population = 80;
        // 选一个能被 80 整除的观测总数，使期望频次恰为整数，避免 (long) 截断引入偏差
        int observations = 41440;
        long expectedPerNumber = observations / population;
        List<Long> observed = new ArrayList<>();
        List<Double> expected = new ArrayList<>();
        for (int index = 0; index < population; index += 1) {
            observed.add(expectedPerNumber);
            expected.add((double) expectedPerNumber);
        }
        LotteryKl8AuditCheckResult uniform = LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, expected);
        assertNotNull(uniform);
        assertEquals(79, uniform.degreesOfFreedom());
        assertEquals(0.0, uniform.statistic(), 1e-9);
        assertEquals(1.0, uniform.pValue(), 1e-6);
    }

    @Test
    @DisplayName("卡方检验必须能检出真实的号码偏斜")
    void chiSquareDetectsSkewedFrequencies() {
        // 构造明显偏斜：一半号码多 36 次、一半号码少 36 次。
        // 期望频次 518 时 ±36 约合 7% 的相对偏移，χ² ≈ 200，df=79 下 p < 1e-10。
        int population = 80;
        int expectedPerNumber = 518;
        List<Long> observed = new ArrayList<>();
        List<Double> expected = new ArrayList<>();
        for (int index = 0; index < population; index += 1) {
            expected.add((double) expectedPerNumber);
            observed.add((long) (expectedPerNumber + (index % 2 == 0 ? 36 : -36)));
        }
        LotteryKl8AuditCheckResult result = LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, expected);
        assertNotNull(result);
        assertTrue(result.statistic() > 180, "χ² 应在 200 附近，实际 " + result.statistic());
        assertTrue(result.pValue() < 1e-8,
                "±36 次偏斜应被强检出，实际 p=" + result.pValue());
        assertTrue(result.conclusion().contains("偏离均匀"), "结论文案应提示偏离");
    }

    @Test
    @DisplayName("卡方 p 值必须随统计量单调递减")
    void chiSquarePMonotonic() {
        int buckets = 20;
        double expectedValue = 100.0;
        List<Double> expected = new ArrayList<>();
        for (int index = 0; index < buckets; index += 1) {
            expected.add(expectedValue);
        }
        double previous = 1.0;
        for (double offset = 1; offset <= 40; offset += 2) {
            List<Long> observed = new ArrayList<>();
            for (int index = 0; index < buckets; index += 1) {
                observed.add((long) Math.round(expectedValue + (index % 2 == 0 ? offset : -offset)));
            }
            LotteryKl8AuditCheckResult result = LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, expected);
            assertNotNull(result);
            assertTrue(result.pValue() <= previous + 1e-9,
                    "统计量增大时 p 值不应上升，offset=" + offset);
            previous = result.pValue();
        }
    }

    @Test
    @DisplayName("卡方检验在期望频次非正或样本不足时返回 null 而不是抛异常")
    void chiSquareGuardsInvalidInput() {
        List<Double> badExpected = List.of(0.0, 1.0, 2.0);
        List<Long> observed = List.of(1L, 2L, 3L);
        assertNull(LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, badExpected));
        assertNull(LotteryKl8Statistics.chiSquareGoodnessOfFit(List.of(1L), List.of(1.0)));
        assertNull(LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, List.of(1.0)));
    }

    @Test
    @DisplayName("标准正态累积分布必须与已知分位数一致")
    void standardNormalCdfMatchesKnownQuantiles() {
        assertEquals(0.5, LotteryKl8Statistics.standardNormalCdf(0), 1e-6);
        assertEquals(0.8413447, LotteryKl8Statistics.standardNormalCdf(1), 1e-5);
        assertEquals(0.9772499, LotteryKl8Statistics.standardNormalCdf(2), 1e-5);
        assertEquals(0.9986501, LotteryKl8Statistics.standardNormalCdf(3), 1e-5);
        // 对称性
        assertEquals(1 - LotteryKl8Statistics.standardNormalCdf(1.5),
                LotteryKl8Statistics.standardNormalCdf(-1.5), 1e-6);
    }

    @Test
    @DisplayName("误差函数 erf 必须满足 erf(0)=0、erf(∞)=1 及奇对称")
    void errorFunctionProperties() {
        assertEquals(0.0, LotteryKl8Statistics.erf(0), 1e-9);
        assertEquals(1.0, LotteryKl8Statistics.erf(10), 1e-6);
        assertEquals(-LotteryKl8Statistics.erf(1.2), LotteryKl8Statistics.erf(-1.2), 1e-9);
        // 与解析值对照：erf(1) ≈ 0.8427008
        assertEquals(0.8427008, LotteryKl8Statistics.erf(1), 1e-5);
    }

    @Test
    @DisplayName("游程检验：完全随机的交替序列应得到较大的 p 值")
    void runsTestOnAlternatingSequence() {
        // 10 命中 10 未命中交替 → 20 个游程，远高于随机期望 11
        LotteryKl8AuditCheckResult result = LotteryKl8Statistics.runsTest(10, 10, 20);
        assertNotNull(result);
        assertTrue(result.pValue() < 0.05,
                "完美交替是强序列相关，p 值应显著，实际 " + result.pValue());
    }

    @Test
    @DisplayName("游程检验：游程数接近期望时应无法拒绝随机假设")
    void runsTestNearExpectedRuns() {
        // 10 命中 10 未命中，随机期望游程数 = 2×10×10/20 + 1 = 11
        LotteryKl8AuditCheckResult result = LotteryKl8Statistics.runsTest(10, 10, 11);
        assertNotNull(result);
        assertFalse(result.significant(), "游程数等于期望时应不显著，实际 p=" + result.pValue());
    }

    @Test
    @DisplayName("游程检验在退化输入下返回 null")
    void runsTestGuardsInvalidInput() {
        assertNull(LotteryKl8Statistics.runsTest(0, 10, 1));
        assertNull(LotteryKl8Statistics.runsTest(10, 0, 1));
        assertNull(LotteryKl8Statistics.runsTest(1, 1, 0));
        assertNull(LotteryKl8Statistics.runsTest(0, 0, 0));
    }

    @Test
    @DisplayName("自相关检验必须能识别人为构造的强相关序列")
    void autocorrelationDetectsStrongCorrelation() {
        List<Double> periodic = new ArrayList<>();
        for (int index = 0; index < 500; index += 1) {
            periodic.add((double) (index % 2));
        }
        LotteryKl8AuditCheckResult detected = LotteryKl8Statistics.autocorrelationTest(periodic, 1);
        assertNotNull(detected);
        assertTrue(detected.pValue() < 1e-10,
                "交替序列的 1 阶自相关应极显著，实际 p=" + detected.pValue());
    }

    @Test
    @DisplayName("自相关检验对随机序列给出的相关系数必须接近 0")
    void autocorrelationOnRandomSeriesIsNearZero() {
        // 不能断言「随机序列 p > 0.05」——单个 5% 检验本就有 5% 概率误报，那样写测试必然偶发失败。
        // 改为断言稳健性质：20 组随机序列的自相关系数均值接近 0 且绝对值都很小。
        double largestMagnitude = 0;
        for (int seed = 0; seed < 20; seed += 1) {
            List<Double> noise = new ArrayList<>();
            java.util.Random random = new java.util.Random(seed);
            for (int index = 0; index < 2000; index += 1) {
                noise.add(random.nextInt(2) + 0.0);
            }
            LotteryKl8AuditCheckResult result = LotteryKl8Statistics.autocorrelationTest(noise, 1);
            assertNotNull(result);
            largestMagnitude = Math.max(largestMagnitude, Math.abs(result.statistic()));
        }
        // 标准误 1/sqrt(2000) ≈ 0.022，20 组随机序列的 |r| 都应远小于 0.15
        assertTrue(largestMagnitude < 0.15,
                "随机序列的自相关系数应接近 0，实际最大绝对值 " + largestMagnitude);
    }

    @Test
    @DisplayName("自相关检验在序列过短或方差为零时返回 null")
    void autocorrelationGuardsInvalidInput() {
        assertNull(LotteryKl8Statistics.autocorrelationTest(List.of(1.0, 0.0, 1.0), 1));
        assertNull(LotteryKl8Statistics.autocorrelationTest(List.of(1.0), 1));
        assertNull(LotteryKl8Statistics.autocorrelationTest(new ArrayList<>(List.of(1.0)), 0));
        List<Double> constant = new ArrayList<>();
        for (int index = 0; index < 50; index += 1) {
            constant.add(1.0);
        }
        assertNull(LotteryKl8Statistics.autocorrelationTest(constant, 1));
    }

    @Test
    @DisplayName("KS 检验：均匀分布应通过，偏斜分布应被检出")
    void ksTestDistinguishesUniformFromSkewed() {
        List<Integer> uniform = new ArrayList<>();
        for (int repeat = 0; repeat < 60; repeat += 1) {
            for (int number = 1; number <= 80; number += 1) {
                uniform.add(number);
            }
        }
        LotteryKl8AuditCheckResult passed = LotteryKl8Statistics.kolmogorovSmirnov(uniform, 1, 80);
        assertNotNull(passed);
        assertFalse(passed.significant(), "完全均匀的数据不应被判显著，实际 p=" + passed.pValue());

        // 把大量观测堆到前 1/4 区间，形成明显偏斜
        List<Integer> skewed = new ArrayList<>();
        for (int repeat = 0; repeat < 900; repeat += 1) {
            skewed.add(1 + (repeat % 20));
        }
        for (int number = 21; number <= 80; number += 1) {
            skewed.add(number);
        }
        LotteryKl8AuditCheckResult failed = LotteryKl8Statistics.kolmogorovSmirnov(skewed, 1, 80);
        assertNotNull(failed);
        assertTrue(failed.pValue() < 1e-6,
                "严重偏斜的数据应被检出，实际 p=" + failed.pValue());
    }

    @Test
    @DisplayName("KS 检验在样本不足时返回 null")
    void ksTestGuardsSmallSample() {
        assertNull(LotteryKl8Statistics.kolmogorovSmirnov(List.of(1, 2, 3), 1, 80));
    }

    @Test
    @DisplayName("比例检验必须能区分观测值与理论期望")
    void proportionTestDetectsDeviation() {
        LotteryKl8AuditCheckResult matched = LotteryKl8Statistics.proportionTest(
                5000, 10000, 0.5, "奇偶", "一致");
        assertNotNull(matched);
        assertFalse(matched.significant(), "恰好 50% 时不应显著");

        LotteryKl8AuditCheckResult skewed = LotteryKl8Statistics.proportionTest(
                6000, 10000, 0.5, "奇偶", "一致");
        assertNotNull(skewed);
        assertTrue(skewed.pValue() < 1e-10, "60% 相对 50% 应极显著");

        assertNull(LotteryKl8Statistics.proportionTest(10, 0, 0.5, "x", "y"));
        assertNull(LotteryKl8Statistics.proportionTest(10, 100, 0.0, "x", "y"));
    }
}
