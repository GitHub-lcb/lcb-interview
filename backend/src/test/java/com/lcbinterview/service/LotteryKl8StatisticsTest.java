package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LotteryKl8StatisticsTest {

    private static final double BASELINE_AT_LEAST_THREE = 0.096672;

    @Test
    void matchesKnownHypergeometricProbabilities() {
        // C(20,5)/C(80,5) = 15504/24040016
        assertEquals(0.000645, LotteryKl8Statistics.exactHitProbability(5, 5), 0.000001);
        // 中 3 个及以上 = 9.6672%
        assertEquals(BASELINE_AT_LEAST_THREE, LotteryKl8Statistics.atLeastHitProbability(5, 3), 0.000001);
        // 中 4 个及以上 = P(4) + P(5) = 1.2737%
        assertEquals(0.012737, LotteryKl8Statistics.atLeastHitProbability(5, 4), 0.000001);
        assertEquals(0.012092, LotteryKl8Statistics.exactHitProbability(5, 4), 0.000001);
        // 期望命中 = 5 × 20 / 80
        assertEquals(1.25, LotteryKl8Statistics.expectedHits(5), 0.000001);
        // 命中概率之和必须为 1
        double total = 0;
        for (int hits = 0; hits <= 5; hits += 1) {
            total += LotteryKl8Statistics.exactHitProbability(5, hits);
        }
        assertEquals(1.0, total, 0.000001);
    }

    @Test
    void wilsonIntervalCoversObservedRate() {
        double[] interval = LotteryKl8Statistics.wilsonInterval(20, 200);

        assertEquals(0.1, (double) 20 / 200, 0.000001);
        assertTrue(interval[0] < 0.1 && interval[1] > 0.1, "区间必须覆盖观测值");
        // 200 期样本的区间宽度约 ±5 个百分点，远大于常见策略差异
        assertTrue(interval[1] - interval[0] > 0.05, "小样本区间应明显偏宽，实际宽度 " + (interval[1] - interval[0]));
        // 零样本不能产生非法区间
        double[] empty = LotteryKl8Statistics.wilsonInterval(0, 0);
        assertEquals(0, empty[0], 0.000001);
        assertEquals(1, empty[1], 0.000001);
    }

    @Test
    void requiresYearsOfDataToConfirmOnePointLift() {
        int required = LotteryKl8Statistics.requiredSampleSize(BASELINE_AT_LEAST_THREE, 0.01);

        // 双侧 95% 置信 + 80% 效能下约 7000 期，快乐8 每天一期相当于十几年
        assertTrue(required > 6500 && required < 7600, "确认 +1 个百分点所需样本量应在 7000 期量级，实际 " + required);
        // 提升越小需要的样本越多
        assertTrue(LotteryKl8Statistics.requiredSampleSize(BASELINE_AT_LEAST_THREE, 0.005) > required);
    }

    @Test
    void zScoreMeasuresDeviationFromBaseline() {
        // 300 期里中 3 个及以上 45 次（15%），明显高于 9.67% 基线
        assertTrue(LotteryKl8Statistics.zScore(45, 300, BASELINE_AT_LEAST_THREE) > 2.5);
        // 恰好等于基线时 z 为 0
        int atBaseline = (int) Math.round(BASELINE_AT_LEAST_THREE * 300);
        assertTrue(Math.abs(LotteryKl8Statistics.zScore(atBaseline, 300, BASELINE_AT_LEAST_THREE)) < 0.3);
        assertEquals(0, LotteryKl8Statistics.zScore(0, 0, BASELINE_AT_LEAST_THREE), 0.000001);
    }
}
