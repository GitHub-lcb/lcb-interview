package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 校准统计原语测试：闸门判定是全链路唯一的放行依据，必须先保证公式本身正确。
 */
class JevCalibrationStatisticsTest {

    @Test
    void tCriticalMatchesStandardTable() {
        assertEquals(6.314, JevCalibrationStatistics.tCriticalOneSided95(1), 0.000001);
        assertEquals(2.015, JevCalibrationStatistics.tCriticalOneSided95(5), 0.000001);
        assertEquals(1.812, JevCalibrationStatistics.tCriticalOneSided95(10), 0.000001);
        assertEquals(1.697, JevCalibrationStatistics.tCriticalOneSided95(30), 0.000001);
        // 自由度超过 30 后回退正态临界值 1.645
        assertEquals(1.645, JevCalibrationStatistics.tCriticalOneSided95(200), 0.000001);
        // 非法自由度不应抛出，取最保守值
        assertEquals(6.314, JevCalibrationStatistics.tCriticalOneSided95(0), 0.000001);
    }

    @Test
    void normalCdfMatchesKnownQuantiles() {
        assertEquals(0.5, JevCalibrationStatistics.normalCdf(0), 0.0000001);
        assertEquals(0.95, JevCalibrationStatistics.normalCdf(1.6449), 0.0001);
        assertEquals(0.025, JevCalibrationStatistics.normalCdf(-1.96), 0.0001);
        assertEquals(0.0, JevCalibrationStatistics.normalCdf(Double.NEGATIVE_INFINITY), 0.0000001);
        assertEquals(1.0, JevCalibrationStatistics.normalCdf(Double.POSITIVE_INFINITY), 0.0000001);
        assertEquals(0.5, JevCalibrationStatistics.normalCdf(Double.NaN), 0.0000001);
    }

    @Test
    void erfIsOddAndSaturates() {
        assertEquals(0.0, JevCalibrationStatistics.erf(0), 0.0000001);
        assertEquals(0.8427, JevCalibrationStatistics.erf(1), 0.0001);
        assertEquals(-0.8427, JevCalibrationStatistics.erf(-1), 0.0001);
        assertTrue(JevCalibrationStatistics.erf(6) > 0.999);
    }

    @Test
    void identicalDiffsWithoutDirectionDoNotPass() {
        List<Double> diffs = new ArrayList<>();
        for (int index = 0; index < 10; index += 1) {
            diffs.add(0.0);
        }
        JevCalibrationStatistics.PairedTestResult result = JevCalibrationStatistics.oneSided95(diffs);

        assertEquals(0.0, result.mean(), 0.000001);
        assertFalse(result.passed(), "差值恒为 0 时不能放行");
    }

    @Test
    void consistentImprovementPassesGate() {
        // 模拟具备真实判别力的场景：每期 Brier 差值稳定在 -0.024 附近并带有少量波动
        List<Double> diffs = new ArrayList<>();
        for (int index = 0; index < 8; index += 1) {
            diffs.add(-0.024 + (index % 3 - 1) * 0.002);
        }
        JevCalibrationStatistics.PairedTestResult result = JevCalibrationStatistics.oneSided95(diffs);

        assertTrue(result.mean() < 0, "均值方向应当为 Jev 更优");
        assertTrue(result.tStatistic() < -result.criticalValue(),
                "t 值应越过临界值，实际 t=" + result.tStatistic());
        assertTrue(result.passed(), "稳定且幅度足够的改进应当放行");
    }

    @Test
    void consistentDeteriorationIsRejected() {
        // Jev 概率比常数基线更差时不能放行，且不需要外推所需样本量
        List<Double> diffs = new ArrayList<>();
        for (int index = 0; index < 8; index += 1) {
            diffs.add(0.01 + index * 0.0001);
        }
        JevCalibrationStatistics.PairedTestResult result = JevCalibrationStatistics.oneSided95(diffs);

        assertTrue(result.mean() > 0);
        assertFalse(result.passed(), "劣于基线时必须拒绝");
        assertNull(JevCalibrationStatistics.requiredIssues(result.mean(), result.stdDev()));
    }

    @Test
    void noiseAroundZeroIsRejected() {
        // 纯噪声：差值在 0 附近抖动，不应被误判为信号
        List<Double> diffs = List.of(0.004, -0.006, 0.002, -0.001, 0.005, -0.003, 0.001, -0.002);
        JevCalibrationStatistics.PairedTestResult result = JevCalibrationStatistics.oneSided95(diffs);

        assertFalse(result.passed(), "噪声不得通过闸门");
        assertTrue(result.pValue() > 0.05, "噪声的 p 值应偏大，实际 " + result.pValue());
    }

    @Test
    void requiredIssuesGrowsAsEffectShrinks() {
        // -0.02 / 0.01：df=2 的临界值 2.920 → 需要 n >= (1.46)^2 = 2.13，最小可行 n = 3
        assertEquals(3, JevCalibrationStatistics.requiredIssues(-0.02, 0.01));
        // -0.002 / 0.01：需要 n >= (1.645*5)^2 = 67.65，最小可行 n = 68
        assertEquals(68, JevCalibrationStatistics.requiredIssues(-0.002, 0.01));

        Integer strong = JevCalibrationStatistics.requiredIssues(-0.02, 0.01);
        Integer weak = JevCalibrationStatistics.requiredIssues(-0.002, 0.01);
        assertNotNull(strong);
        assertNotNull(weak);
        assertTrue(weak > strong, "效应越弱所需期数越多：" + weak + " vs " + strong);
        assertNull(JevCalibrationStatistics.requiredIssues(0.001, 0.01), "方向不对时不外推");
        assertNull(JevCalibrationStatistics.requiredIssues(-0.02, 0.0), "无波动时不外推");
    }
}
