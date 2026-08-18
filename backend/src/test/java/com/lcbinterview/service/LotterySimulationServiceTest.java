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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LotterySimulationServiceTest {

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

        LotterySimulationService service = new LotterySimulationService(
                kl8Mapper, ssqMapper, dltMapper, simulationMapper, new com.fasterxml.jackson.databind.ObjectMapper());

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

        LotterySimulationService service = new LotterySimulationService(
                kl8Mapper, ssqMapper, dltMapper, simulationMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        try {
            service.run(7L, "UNKNOWN", 100);
            org.junit.jupiter.api.Assertions.fail("未知类型应抛异常");
        } catch (com.lcbinterview.common.BusinessException e) {
            assertTrue(e.getMessage().contains("KL8/SSQ/DLT"));
        }
    }

    @Test
    void clampsWindowSize() {
        // 验证 100-1000 边界钳制：9999 → 1000
        SsqDrawMapper ssqMapper = mock(SsqDrawMapper.class);
        LotteryKl8DrawMapper kl8Mapper = mock(LotteryKl8DrawMapper.class);
        DltDrawMapper dltMapper = mock(DltDrawMapper.class);
        LotterySimulationMapper simulationMapper = mock(LotterySimulationMapper.class);

        when(ssqMapper.selectList(any(Wrapper.class))).thenReturn(ssqHistory(1050));
        LotterySimulationService service = new LotterySimulationService(
                kl8Mapper, ssqMapper, dltMapper, simulationMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        LotterySimulationVO vo = service.run(7L, "SSQ", 9999);
        assertEquals(1000, vo.windowSize());
        assertEquals(1000, vo.evaluatedCount());
    }
}
