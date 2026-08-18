package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.model.DltDraw;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DltFeatureServiceTest {

    private DltDraw draw(String issueNo, String fronts, String backs) {
        DltDraw draw = new DltDraw();
        draw.setIssueNo(issueNo);
        draw.setDrawDate(LocalDate.now());
        draw.setFrontNumbers(fronts);
        draw.setBackNumbers(backs);
        return draw;
    }

    private List<DltDraw> history(int count) {
        List<DltDraw> draws = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            String issue = String.format("%05d", 20001 + index);
            String fronts;
            if (index % 3 == 0) {
                fronts = "1,2,3,4,5";
            } else if (index % 3 == 1) {
                fronts = "1,2,3,6,7";
            } else {
                fronts = "1,2,3,8,9";
            }
            String backs = String.valueOf(1 + index % 3) + "," + String.valueOf(4 + index % 3);
            draws.add(draw(issue, fronts, backs));
        }
        // 与 SQL 语义一致：最新一期在前
        java.util.Collections.reverse(draws);
        return draws;
    }

    @Test
    void generatesFiveFrontsAndThreeBacks() {
        DltDrawMapper mapper = mock(DltDrawMapper.class);
        List<DltDraw> draws = history(90);
        when(mapper.selectOne(any(Wrapper.class))).thenReturn(draws.getFirst());
        when(mapper.selectRecentUpTo(anyString(), anyInt())).thenReturn(draws);

        DltFeatureService service = new DltFeatureService(mapper);
        DltFeatureService.DltPicks picks = service.generatePicks(80);
        DltFeatureService.DltPicks historyPicks = service.generatePicksFromDraws(draws, 80);

        assertEquals(5, picks.frontPicks().size());
        assertTrue(picks.frontPicks().stream().allMatch(number -> number >= 1 && number <= 35));
        assertEquals(new java.util.LinkedHashSet<>(picks.frontPicks()).size(), 5, "前区不能重复");
        assertEquals(3, picks.backPicks().size());
        assertTrue(picks.backPicks().stream().allMatch(number -> number >= 1 && number <= 12));
        assertEquals(new java.util.LinkedHashSet<>(picks.backPicks()).size(), 3, "后区不能重复");
        // 高频前区 1、2、3 应被选中
        assertTrue(picks.frontPicks().contains(1));
        assertTrue(picks.frontPicks().contains(2));
        assertTrue(picks.frontPicks().contains(3));
        assertTrue(picks.report().backtest().evaluatedIssueCount() > 0);
        assertEquals(picks.frontPicks(), historyPicks.frontPicks());
        assertEquals(picks.backPicks(), historyPicks.backPicks());
    }

    @Test
    void throwsWhenHistoryTooShort() {
        DltDrawMapper mapper = mock(DltDrawMapper.class);
        when(mapper.selectOne(any(Wrapper.class))).thenReturn(history(5).getFirst());
        when(mapper.selectRecentUpTo(anyString(), anyInt())).thenReturn(history(5));

        DltFeatureService service = new DltFeatureService(mapper);
        try {
            service.generatePicks(80);
            org.junit.jupiter.api.Assertions.fail("历史不足应抛异常");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("不足"));
        }
    }
}
