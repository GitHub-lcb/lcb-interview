package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8CoverageCurveRowVO;
import com.lcbinterview.dto.tools.LotteryKl8CoverageReportVO;
import com.lcbinterview.dto.tools.LotteryKl8CoverageTargetRowVO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 覆盖优化服务测试：验证概率曲线的自洽性与「返奖率恒定」这一核心结论。
 */
class LotteryKl8CoverageServiceTest {

    private final LotteryKl8CoverageService service = new LotteryKl8CoverageService();

    @Test
    @DisplayName("单注期望回报与返奖率必须与官方奖金表一致")
    void expectedReturnMatchesOfficialPrizeTable() {
        // 选4 奖金：中 2 → 3 元，中 3 → 5 元，中 4 → 93 元
        // 0.21263547×3 + 0.04324789×5 + 0.00306339×93 ≈ 1.1390 元
        assertEquals(1.1390, service.expectedReturnPerTicket(4), 1e-3);
        LotteryKl8CoverageReportVO report = service.report(4, 2, 20, 0);
        assertEquals(0.5695, report.payoutRate(), 1e-3);
        assertEquals(0.8610, report.netLossPerTicketYuan(), 1e-3);
    }

    @Test
    @DisplayName("返奖率必须与注数无关——这是「加注不改变长期亏损」的严格依据")
    void payoutRateIsIndependentOfTicketCount() {
        List<LotteryKl8CoverageCurveRowVO> curve = service.report(4, 2, 20, 0).curve();
        assertFalse(curve.isEmpty());
        double first = curve.getFirst().payoutRate();
        for (LotteryKl8CoverageCurveRowVO row : curve) {
            assertEquals(first, row.payoutRate(), 1e-6, "注数 " + row.ticketCount() + " 的返奖率应保持恒定");
        }
    }

    @Test
    @DisplayName("期望回报必须与注数严格成正比")
    void expectedReturnScalesLinearlyWithTickets() {
        double perTicket = service.expectedReturnPerTicket(4);
        for (LotteryKl8CoverageCurveRowVO row : service.report(4, 2, 20, 0).curve()) {
            assertEquals(perTicket * row.ticketCount(), row.expectedReturnYuan(), 1e-3,
                    "注数 " + row.ticketCount() + " 的期望回报应为其线性倍数");
        }
    }

    @Test
    @DisplayName("曲线必须单调不减，覆盖号码数等于 4 倍注数")
    void curveIsMonotonicAndCoversDistinctNumbers() {
        List<LotteryKl8CoverageCurveRowVO> curve = service.report(4, 2, 20, 0).curve();
        assertEquals(20, curve.size());
        double previous = -1;
        for (int index = 0; index < curve.size(); index += 1) {
            LotteryKl8CoverageCurveRowVO row = curve.get(index);
            assertEquals(index + 1, row.ticketCount());
            assertEquals(4 * (index + 1), row.coveredNumbers());
            assertTrue(row.atLeastMinHitRate() >= previous,
                    "第 " + row.ticketCount() + " 注概率不应下降");
            previous = row.atLeastMinHitRate();
        }
    }

    @Test
    @DisplayName("概率在饱和前必须严格递增，饱和后收敛到 1")
    void curveSaturatesOnlyAfterStrictGrowth() {
        List<LotteryKl8CoverageCurveRowVO> curve = service.report(4, 2, 20, 0).curve();
        for (int index = 1; index < curve.size(); index += 1) {
            double previousRate = curve.get(index - 1).atLeastMinHitRate();
            double currentRate = curve.get(index).atLeastMinHitRate();
            if (previousRate < 0.99) {
                assertTrue(currentRate > previousRate,
                        "概率未饱和时第 " + curve.get(index).ticketCount() + " 注应严格高于上一注");
            }
        }
        // 20 注覆盖全部 80 个号：精确值 0.9999997，逼近但严格小于 1
        // （「20 个中奖号恰好每注各中 1 个」时无一注达标）。
        // 该性质由 LotteryKl8CoverageMathTest 在未舍入值上断言；
        // VO 保留 6 位小数，0.9999997 会舍入为 1.0，故此处只校验不超过 1。
        double fullCoverage = curve.getLast().atLeastMinHitRate();
        assertTrue(fullCoverage >= 0.9999 && fullCoverage <= 1.0,
                "全号覆盖下概率应逼近 1，实际为 " + fullCoverage);
    }

    @Test
    @DisplayName("达标门槛越高，同等注数下的概率越低")
    void higherThresholdYieldsLowerProbability() {
        LotteryKl8CoverageReportVO report = service.report(4, 2, 20, 0);
        for (LotteryKl8CoverageCurveRowVO row : report.curve()) {
            assertTrue(row.atLeastMinHitRate() > row.atLeastThreeRate(),
                    "注数 " + row.ticketCount() + "：至少中 2 应高于至少中 3");
            assertTrue(row.atLeastThreeRate() > row.fullHitRate(),
                    "注数 " + row.ticketCount() + "：至少中 3 应高于全中");
        }
    }

    @Test
    @DisplayName("边际效用递减：单位成本换到的概率必须越来越少")
    void marginalUtilityDecreases() {
        List<LotteryKl8CoverageCurveRowVO> curve = service.report(4, 2, 20, 0).curve();
        // 首注没有「上一注」可比较，其单位成本不参与递减判定。
        // 注数逼近上限时概率饱和、边际提升趋近 0，因此只要求非严格递减。
        double previousLift = Double.MAX_VALUE;
        for (int index = 1; index < curve.size(); index += 1) {
            double lift = curve.get(index).marginalLift();
            assertTrue(lift <= previousLift,
                    "第 " + curve.get(index).ticketCount() + " 注的概率提升 " + lift
                            + " 不应高于上一注的 " + previousLift);
            previousLift = lift;
        }
        // 饱和前的边际提升必须严格递减，否则「加注性价比越来越低」的结论不成立
        for (int index = 1; index < curve.size() - 2; index += 1) {
            assertTrue(curve.get(index).marginalLift() > curve.get(index + 1).marginalLift(),
                    "饱和前第 " + curve.get(index).ticketCount() + " 注的提升应严格高于下一注");
        }
    }

    @Test
    @DisplayName("目标概率反查：所需注数必须真的达到目标")
    void targetLookupActuallyReachesTarget() {
        for (LotteryKl8CoverageTargetRowVO row : service.report(4, 2, 20, 0).targets()) {
            assertTrue(row.requiredTickets() > 0, "目标 " + row.targetRate() + " 应能找到所需注数");
            assertTrue(row.achievedRate() >= row.targetRate(),
                    "目标 " + row.targetRate() + " 实际只达到 " + row.achievedRate());
            assertEquals(4 * row.requiredTickets(), row.coveredNumbers());
            assertEquals(2.0 * row.requiredTickets(), row.costYuan(), 1e-6);
        }
    }

    @Test
    @DisplayName("预算分析：可买注数与可达概率必须与预算一致")
    void budgetAnalysisMatchesBudget() {
        LotteryKl8CoverageReportVO report = service.report(4, 2, 20, 15);
        assertEquals(15, report.budgetYuan(), 1e-6);
        assertEquals(7, report.budgetTicketCount());
        assertEquals(
                LotteryKl8Statistics.atLeastOneTicketProbability(7, 4, 2),
                report.budgetAchievableRate(),
                1e-4);
        assertTrue(report.conclusion().contains("预算 15 元"));
    }

    @Test
    @DisplayName("预算不足 1 注时不应给出概率结论")
    void insufficientBudgetYieldsNoTickets() {
        LotteryKl8CoverageReportVO report = service.report(4, 2, 20, 1);
        assertEquals(0, report.budgetTicketCount());
        assertEquals(0, report.budgetAchievableRate(), 1e-6);
    }

    @Test
    @DisplayName("注数上限被号码池钳制，非法参数回退默认值")
    void clampsAndFallsBackOnInvalidInput() {
        // 选 4 时号码池最多容纳 20 注互不重复，请求 50 注应被钳制
        assertEquals(20, service.report(4, 2, 50, 0).curve().size());
        assertEquals(4, service.report(4, 2, 0, 0).pickSize());
        assertEquals(2, service.report(-1, -1, -1, 0).minHitLevel());
    }

    @Test
    @DisplayName("结论必须同时说明概率来源与长期亏损代价")
    void conclusionStatesBothSides() {
        String conclusion = service.report(4, 2, 20, 20).conclusion();
        assertTrue(conclusion.contains("数学常量"), "应说明单注概率不可改变");
        assertTrue(conclusion.contains("互不重复"), "应说明唯一有效手段是买不重复的号");
        assertTrue(conclusion.contains("返奖率"), "应给出返奖率");
        assertTrue(conclusion.contains("期望亏损"), "应给出长期亏损");
    }
}
