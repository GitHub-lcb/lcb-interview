package com.lcbinterview.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 覆盖优化数学内核测试。
 * <p>
 * 所有期望值都取自 {@code docs/superpowers/scripts/kl8-probability/coverage_calc.py}
 * 的精确整数复算结果，用于防止内核实现与离线验算脚本出现偏差。
 */
class LotteryKl8CoverageMathTest {

    private static final double TOLERANCE = 1e-6;

    @Test
    @DisplayName("单注口径必须与超几何分布一致，不受内核实现影响")
    void singleTicketMatchesHypergeometric() {
        // 单注「中 2 个及以上」的理论基线
        assertEquals(0.25894675, LotteryKl8Statistics.atLeastOneTicketProbability(1, 4, 2), TOLERANCE);
        assertEquals(0.04631128, LotteryKl8Statistics.atLeastOneTicketProbability(1, 4, 3), TOLERANCE);
        assertEquals(0.00306339, LotteryKl8Statistics.atLeastOneTicketProbability(1, 4, 4), TOLERANCE);
    }

    @Test
    @DisplayName("单注覆盖概率必须等于 atLeastHitProbability，两条独立实现互为校验")
    void singleTicketAgreesWithAtLeastHitProbability() {
        for (int minHits = 1; minHits <= 4; minHits += 1) {
            assertEquals(
                    LotteryKl8Statistics.atLeastHitProbability(4, minHits),
                    LotteryKl8Statistics.atLeastOneTicketProbability(1, 4, minHits),
                    TOLERANCE,
                    "minHits=" + minHits);
        }
    }

    @Test
    @DisplayName("多注覆盖概率对照离线精确复算值")
    void multiTicketMatchesOfflineCalculation() {
        // [注数, 至少中2, 至少中3, 中4]
        double[][] expected = {
                {1, 0.258947, 0.046311, 0.0030634},
                {2, 0.457758, 0.091105, 0.0061224},
                {3, 0.608707, 0.134414, 0.0091771},
                {4, 0.721925, 0.176269, 0.0122275},
                {5, 0.805708, 0.216701, 0.0152735},
                {6, 0.866790, 0.255741, 0.0183152},
                {8, 0.941408, 0.329768, 0.0243856},
                {10, 0.976926, 0.398586, 0.0304386},
                {15, 0.999008, 0.549367, 0.0454955},
                {16, 0.999588, 0.576101, 0.0484940},
                {20, 1.000000, 0.672534, 0.0604446},
        };
        for (double[] row : expected) {
            int tickets = (int) row[0];
            assertEquals(row[1], LotteryKl8Statistics.atLeastOneTicketProbability(tickets, 4, 2), 5e-6,
                    "tickets=" + tickets + " minHits=2");
            assertEquals(row[2], LotteryKl8Statistics.atLeastOneTicketProbability(tickets, 4, 3), 5e-6,
                    "tickets=" + tickets + " minHits=3");
            assertEquals(row[3], LotteryKl8Statistics.atLeastOneTicketProbability(tickets, 4, 4), 5e-6,
                    "tickets=" + tickets + " minHits=4");
        }
    }

    @Test
    @DisplayName("概率必须随注数单调递增——这是「多买不重复」有效的数学前提")
    void probabilityIncreasesMonotonicallyWithTickets() {
        double previous = -1;
        for (int tickets = 1; tickets <= 20; tickets += 1) {
            double current = LotteryKl8Statistics.atLeastOneTicketProbability(tickets, 4, 2);
            assertTrue(current > previous, "注数 " + tickets + " 的概率应高于 " + (tickets - 1) + " 注");
            previous = current;
        }
    }

    @Test
    @DisplayName("目标概率反查结果与离线复算一致")
    void reverseLookupMatchesOfflineCalculation() {
        assertEquals(2, LotteryKl8Statistics.ticketsForTargetProbability(0.30, 4, 2));
        assertEquals(2, LotteryKl8Statistics.ticketsForTargetProbability(0.40, 4, 2));
        assertEquals(3, LotteryKl8Statistics.ticketsForTargetProbability(0.50, 4, 2));
        assertEquals(3, LotteryKl8Statistics.ticketsForTargetProbability(0.60, 4, 2));
        assertEquals(5, LotteryKl8Statistics.ticketsForTargetProbability(0.80, 4, 2));
        assertEquals(9, LotteryKl8Statistics.ticketsForTargetProbability(0.95, 4, 2));
    }

    @Test
    @DisplayName("覆盖全部 80 个号后概率饱和，但不等于 1——中奖号仍可能每注只中 1 个")
    void fullCoverageSaturatesWithoutReachingOne() {
        // 20 注覆盖全部 80 个号：至少中 2 逼近 1，但严格小于 1
        // （20 个中奖号恰好每注各中 1 个时，无一注达标）
        double atLeastTwo = LotteryKl8Statistics.atLeastOneTicketProbability(20, 4, 2);
        assertTrue(atLeastTwo > 0.9999 && atLeastTwo < 1.0,
                "全号覆盖下「至少中 2」应逼近但不超过 1，实际为 " + atLeastTwo);
        // 门槛越高饱和越慢：全号覆盖也拦不住「每注只中 1 个」的结果
        assertEquals(0.672534, LotteryKl8Statistics.atLeastOneTicketProbability(20, 4, 3), 5e-6);
        assertEquals(0.0604446, LotteryKl8Statistics.atLeastOneTicketProbability(20, 4, 4), 5e-6);
        // 注数超出号码池上限后与 20 注等价，不应继续上升
        assertEquals(atLeastTwo, LotteryKl8Statistics.atLeastOneTicketProbability(21, 4, 2), TOLERANCE);
        assertEquals(20, LotteryKl8Statistics.maxDisjointTickets(4));
    }

    @Test
    @DisplayName("组合数大参数不得溢出——C(80,20) 约 3.5e18，连乘中间量超出 long 上限")
    void combinationsDoNotOverflow() {
        // exactHitProbability 内部会用到 C(80,20)，long 实现会静默溢出为负数
        double exactFour = LotteryKl8Statistics.exactHitProbability(4, 4);
        assertTrue(exactFour > 0, "C(80,4) 口径下的中 4 概率必须为正，实际为 " + exactFour);
        assertEquals(0.00306339, exactFour, TOLERANCE);
        // pickSize=10 时分子为 C(20,h)·C(60,10-h)，long 连乘会溢出
        assertTrue(LotteryKl8Statistics.atLeastHitProbability(10, 1) > 0);
        assertTrue(LotteryKl8Statistics.exactHitProbability(20, 10) > 0);
    }

    @Test
    @DisplayName("非法入参返回 0 而不是抛异常")
    void invalidArgumentsReturnZero() {
        assertEquals(0, LotteryKl8Statistics.atLeastOneTicketProbability(0, 4, 2), TOLERANCE);
        assertEquals(0, LotteryKl8Statistics.atLeastOneTicketProbability(3, 0, 2), TOLERANCE);
        assertEquals(0, LotteryKl8Statistics.atLeastOneTicketProbability(3, 4, 0), TOLERANCE);
        assertEquals(0, LotteryKl8Statistics.ticketsForTargetProbability(0, 4, 2));
        assertEquals(0, LotteryKl8Statistics.ticketsForTargetProbability(1.5, 4, 2));
        assertEquals(0, LotteryKl8Statistics.maxDisjointTickets(0));
    }
}
