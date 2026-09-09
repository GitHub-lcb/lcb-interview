package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.dto.tools.LotteryKl8LabPortfolioRowVO;
import com.lcbinterview.dto.tools.LotteryKl8LabReportVO;
import com.lcbinterview.dto.tools.LotteryKl8LabRequest;
import com.lcbinterview.dto.tools.LotteryKl8LabVariantVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LotteryKl8LabServiceTest {

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void reportsVariantsAndPortfoliosAgainstTheoreticalBaseline() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any(Wrapper.class))).thenReturn(randomDraws(260, 20260909L));
        LotteryKl8FeatureService featureService = new LotteryKl8FeatureService(mapper);
        LotteryKl8StrategyCalibrationService calibrationService = mock(LotteryKl8StrategyCalibrationService.class);
        when(calibrationService.currentCalibration(7L)).thenReturn(LotteryKl8StrategyCalibration.neutral());
        when(calibrationService.numberHitFeedback(7L)).thenReturn(Map.of());
        LotteryKl8LabService service = new LotteryKl8LabService(mapper, featureService, calibrationService);

        LotteryKl8LabReportVO report = service.run(7L, new LotteryKl8LabRequest(240, 20, 3));

        assertEquals(5, report.pickSize());
        assertEquals(1.25, report.baselineExpectedHits(), 0.000001);
        assertEquals(0.096672, report.baselineAtLeastThreeRate(), 0.000001);
        assertTrue(report.requiredSampleSizeForOnePointLift() > 6500);

        assertFalse(report.variants().isEmpty());
        assertTrue(report.variants().stream().anyMatch(LotteryKl8LabVariantVO::selected),
                "必须有且仅有一个配置被选为当期生产配置");
        assertEquals(1, report.variants().stream().filter(LotteryKl8LabVariantVO::selected).count());
        for (LotteryKl8LabVariantVO variant : report.variants()) {
            assertTrue(variant.evaluatedIssueCount() > 0);
            assertTrue(variant.ciLow() <= variant.atLeastThreeRate()
                    && variant.atLeastThreeRate() <= variant.ciHigh(), "置信区间必须覆盖观测值");
            // 判定与区间一致：区间跨过基线时不能宣称显著
            boolean crossesBaseline = variant.ciLow() <= report.baselineAtLeastThreeRate()
                    && variant.ciHigh() >= report.baselineAtLeastThreeRate();
            if (crossesBaseline) {
                assertFalse(variant.significant(), "区间跨过基线时不应判定为显著");
                assertEquals("与基线无显著差异", variant.verdict());
            }
        }

        assertEquals(3, report.portfolios().size());
        LotteryKl8LabPortfolioRowVO single = report.portfolios().get(0);
        // 1 注时「不重复拆分」与「重复同一注」是同一件事
        assertEquals(single.disjointRate(), single.repeatedRate(), 0.000001);
        assertEquals(0, single.liftOverRepeated(), 0.000001);
        for (LotteryKl8LabPortfolioRowVO row : report.portfolios()) {
            // 第一注始终在拆分组合里，所以不重复拆分不会低于重复同一注
            assertTrue(row.disjointRate() >= row.repeatedRate() - 0.000001,
                    "不重复拆分的达成率不应低于重复同一注：%s".formatted(row));
            assertTrue(row.liftOverSingle() >= -0.000001, "相对单注的提升不应为负：%s".formatted(row));
            assertEquals(20, row.evaluatedIssueCount());
        }
        assertTrue(report.conclusion().contains("超几何分布"));
        assertTrue(report.conclusion().contains("9.67"));
        assertFalse(report.disclaimer().isBlank());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void fixedHistoryMakesEveryDisjointTicketHit() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any(Wrapper.class))).thenReturn(fixedDraws());
        LotteryKl8FeatureService featureService = new LotteryKl8FeatureService(mapper);
        LotteryKl8StrategyCalibrationService calibrationService = mock(LotteryKl8StrategyCalibrationService.class);
        when(calibrationService.currentCalibration(7L)).thenReturn(LotteryKl8StrategyCalibration.neutral());
        when(calibrationService.numberHitFeedback(7L)).thenReturn(Map.of());
        LotteryKl8LabService service = new LotteryKl8LabService(mapper, featureService, calibrationService);

        LotteryKl8LabReportVO report = service.run(7L, new LotteryKl8LabRequest(200, 12, 3));

        // 历史固定开出 1-20，生产推荐必然命中 5 个，多注拆分同样 100%
        LotteryKl8LabPortfolioRowVO threeTickets = report.portfolios().getLast();
        assertEquals(3, threeTickets.ticketCount());
        assertEquals(1.0, threeTickets.disjointRate(), 0.000001);
        assertEquals(1.0, threeTickets.repeatedRate(), 0.000001);
        assertTrue(report.conclusion().contains("投注成本"));
    }

    private List<LotteryKl8Draw> fixedDraws() {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < 160; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo(String.format("%07d", 2026001 + index));
            draw.setDrawDate(LocalDate.of(2026, 1, 1).plusDays(index));
            draw.setNumbers("1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20");
            draws.add(draw);
        }
        java.util.Collections.reverse(draws);
        return draws;
    }

    private List<LotteryKl8Draw> randomDraws(int count, long seed) {
        Random random = new Random(seed);
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo(String.format("%07d", 2026001 + index));
            draw.setDrawDate(LocalDate.of(2026, 1, 1).plusDays(index));
            Set<Integer> numbers = new LinkedHashSet<>();
            while (numbers.size() < 20) {
                numbers.add(random.nextInt(80) + 1);
            }
            draw.setNumbers(numbers.stream().sorted().map(String::valueOf)
                    .reduce((left, right) -> left + "," + right).orElse(""));
            draws.add(draw);
        }
        java.util.Collections.reverse(draws);
        return draws;
    }
}
