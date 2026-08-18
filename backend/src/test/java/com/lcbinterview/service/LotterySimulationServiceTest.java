package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.mapper.LotterySimulationMapper;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.model.DltDraw;
import com.lcbinterview.model.LotteryKl8Draw;
import com.lcbinterview.model.LotterySimulation;
import com.lcbinterview.model.SsqDraw;
import com.lcbinterview.dto.tools.LotterySimulationVO;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LotterySimulationServiceTest {

    private LotterySimulationService service(
            LotteryKl8DrawMapper kl8Mapper,
            SsqDrawMapper ssqMapper,
            DltDrawMapper dltMapper,
            LotterySimulationMapper simulationMapper) {
        LotteryKl8StrategyCalibrationService calibrationService = mock(LotteryKl8StrategyCalibrationService.class);
        when(calibrationService.currentCalibration(anyLong())).thenReturn(LotteryKl8StrategyCalibration.neutral());
        when(calibrationService.numberHitFeedback(anyLong())).thenReturn(Map.of());
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        return new LotterySimulationService(
                kl8Mapper,
                ssqMapper,
                dltMapper,
                simulationMapper,
                objectMapper,
                new LotteryKl8FeatureService(kl8Mapper),
                new LotteryKl8RecommendationPolicy(objectMapper),
                calibrationService,
                new SsqFeatureService(ssqMapper),
                new DltFeatureService(dltMapper));
    }

    private SsqDraw ssqDraw(int index, String reds, String blue) {
        SsqDraw draw = new SsqDraw();
        draw.setIssueNo(String.format("%07d", 2026001 + index));
        draw.setDrawDate(LocalDate.now());
        draw.setRedNumbers(reds);
        draw.setBlueNumber(blue);
        return draw;
    }

    private List<SsqDraw> ssqHistory(int count) {
        List<SsqDraw> draws = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            // 构造稳定数据：1-7 高频出现，蓝球 1-3 轮换
            String reds = switch (index % 3) {
                case 0 -> "1,2,3,4,5,6";
                case 1 -> "1,2,3,7,8,9";
                default -> "1,2,3,10,11,12";
            };
            draws.add(ssqDraw(index, reds, String.valueOf(1 + index % 3)));
        }
        // 与 SQL 语义一致：最新在前
        java.util.Collections.reverse(draws);
        return draws;
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void runsSsqSimulationAndSavesStats() {
        SsqDrawMapper ssqMapper = mock(SsqDrawMapper.class);
        LotteryKl8DrawMapper kl8Mapper = mock(LotteryKl8DrawMapper.class);
        DltDrawMapper dltMapper = mock(DltDrawMapper.class);
        LotterySimulationMapper simulationMapper = mock(LotterySimulationMapper.class);

        when(ssqMapper.selectList(any(Wrapper.class))).thenReturn(ssqHistory(120));
        when(kl8Mapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(dltMapper.selectList(any(Wrapper.class))).thenReturn(List.of());

        LotterySimulationService service = service(kl8Mapper, ssqMapper, dltMapper, simulationMapper);

        // 请求 100 期：最近 100 期评估 + 50 期前置历史
        LotterySimulationVO vo = service.run(7L, "SSQ", 100);

        assertEquals("SSQ", vo.lotteryType());
        assertEquals(100, vo.windowSize());
        assertEquals(100, vo.evaluatedCount());
        assertTrue(vo.avgHits().compareTo(BigDecimal.ZERO) > 0, "高频红球应能命中");
        assertTrue(vo.hitRate().compareTo(BigDecimal.ZERO) > 0);
        assertTrue(vo.summary().contains("模拟 100 期"));
        verify(simulationMapper).insert(any(LotterySimulation.class));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void rejectsUnknownType() {
        SsqDrawMapper ssqMapper = mock(SsqDrawMapper.class);
        LotteryKl8DrawMapper kl8Mapper = mock(LotteryKl8DrawMapper.class);
        DltDrawMapper dltMapper = mock(DltDrawMapper.class);
        LotterySimulationMapper simulationMapper = mock(LotterySimulationMapper.class);

        LotterySimulationService service = service(kl8Mapper, ssqMapper, dltMapper, simulationMapper);

        try {
            service.run(7L, "UNKNOWN", 100);
            org.junit.jupiter.api.Assertions.fail("未知类型应抛异常");
        } catch (com.lcbinterview.common.BusinessException e) {
            assertTrue(e.getMessage().contains("KL8/SSQ/DLT"));
        }
    }

    @Test
    void clampsWindowSize() {
        // 验证 10-1000 边界钳制：9999 → 1000
        SsqDrawMapper ssqMapper = mock(SsqDrawMapper.class);
        LotteryKl8DrawMapper kl8Mapper = mock(LotteryKl8DrawMapper.class);
        DltDrawMapper dltMapper = mock(DltDrawMapper.class);
        LotterySimulationMapper simulationMapper = mock(LotterySimulationMapper.class);

        when(ssqMapper.selectList(any(Wrapper.class))).thenReturn(ssqHistory(1050));
        LotterySimulationService service = service(kl8Mapper, ssqMapper, dltMapper, simulationMapper);

        LotterySimulationVO vo = service.run(7L, "SSQ", 9999);
        assertEquals(1000, vo.windowSize());
        assertEquals(1000, vo.evaluatedCount());
    }

    @Test
    void clampsWindowSizeToTen() {
        SsqDrawMapper ssqMapper = mock(SsqDrawMapper.class);
        LotteryKl8DrawMapper kl8Mapper = mock(LotteryKl8DrawMapper.class);
        DltDrawMapper dltMapper = mock(DltDrawMapper.class);
        LotterySimulationMapper simulationMapper = mock(LotterySimulationMapper.class);

        when(ssqMapper.selectList(any(Wrapper.class))).thenReturn(ssqHistory(60));
        LotterySimulationService service = service(kl8Mapper, ssqMapper, dltMapper, simulationMapper);

        LotterySimulationVO vo = service.run(7L, "SSQ", 1);
        assertEquals(10, vo.windowSize());
        assertEquals(10, vo.evaluatedCount());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void kl8SimulationCountsFullFourAndRewardThreshold() {
        SsqDrawMapper ssqMapper = mock(SsqDrawMapper.class);
        DltDrawMapper dltMapper = mock(DltDrawMapper.class);
        LotterySimulationMapper simulationMapper = mock(LotterySimulationMapper.class);
        LotteryKl8DrawMapper kl8Mapper = mock(LotteryKl8DrawMapper.class);

        // 构造 KL8 历史：前 100 期固定号码 1-20，使预测稳定命中
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < 150; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo(String.format("%07d", 2026001 + index));
            draw.setDrawDate(LocalDate.now());
            draw.setNumbers("1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20");
            draws.add(draw);
        }
        java.util.Collections.reverse(draws);
        when(kl8Mapper.selectList(any(Wrapper.class))).thenReturn(draws);

        LotterySimulationService service = service(kl8Mapper, ssqMapper, dltMapper, simulationMapper);

        LotterySimulationVO vo = service.run(7L, "KL8", 100);

        assertEquals("KL8", vo.lotteryType());
        assertEquals(100, vo.evaluatedCount());
        // 固定开奖 1-20，预测 8 个高频号应全部命中两组各 4 个：中4 期数 > 0
        assertTrue(vo.hit4Count() > 0, "固定历史下应存在单组全中 4 个的期数，实际 " + vo.hit4Count());
        // 中 2 个及以上占比应为 100%（每组都中 4 个）
        assertEquals(100.00, vo.hitRate().doubleValue(), 0.001);
        assertEquals(0, vo.zeroHitCount());
        assertTrue(vo.summary().contains("中 2 个及以上"));
        assertTrue(vo.summary().contains("单组全中 4 个"));
        // 命中分布：固定历史下 4 个命中期数 = 全部 100 期
        String distribution = vo.hitDistribution();
        assertTrue(distribution.contains("\"4\""), "分布应包含中4期数，实际 " + distribution);
    }
}
