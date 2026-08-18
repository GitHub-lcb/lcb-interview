package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.model.SsqDraw;
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

class SsqFeatureServiceTest {

    private SsqDraw draw(String issueNo, String reds, String blue) {
        SsqDraw draw = new SsqDraw();
        draw.setIssueNo(issueNo);
        draw.setDrawDate(LocalDate.now());
        draw.setRedNumbers(reds);
        draw.setBlueNumber(blue);
        return draw;
    }

    private List<SsqDraw> history(int count) {
        List<SsqDraw> draws = new ArrayList<>();
        // 构造稳定历史：1-6 常出，其余偶尔出，方便断言推荐倾向
        for (int index = 0; index < count; index += 1) {
            String issue = String.format("%07d", 2026001 + index);
            String reds;
            if (index % 3 == 0) {
                reds = "1,2,3,4,5,6";
            } else if (index % 3 == 1) {
                reds = "1,2,3,7,8,9";
            } else {
                reds = "1,2,3,10,11,12";
            }
            String blue = String.valueOf(1 + index % 3);
            draws.add(draw(issue, reds, blue));
        }
        // 与 SQL 语义一致：最新一期在前（降序），便于 getFirst() 取最新
        java.util.Collections.reverse(draws);
        return draws;
    }

    @Test
    void generatesSevenRedsAndOneBlue() {
        SsqDrawMapper mapper = mock(SsqDrawMapper.class);
        List<SsqDraw> draws = history(90);
        when(mapper.selectOne(any(Wrapper.class))).thenReturn(draws.getFirst());
        when(mapper.selectRecentUpTo(anyString(), anyInt())).thenReturn(draws);

        SsqFeatureService service = new SsqFeatureService(mapper);
        SsqFeatureService.SsqPicks picks = service.generatePicks(80);
        SsqFeatureService.SsqPicks historyPicks = service.generatePicksFromDraws(draws, 80);

        assertEquals(7, picks.redPicks().size());
        assertTrue(picks.redPicks().stream().allMatch(number -> number >= 1 && number <= 33));
        assertEquals(new java.util.LinkedHashSet<>(picks.redPicks()).size(), 7, "红球不能重复");
        assertTrue(picks.bluePick() >= 1 && picks.bluePick() <= 16);
        // 高频红球 1、2、3 应被选中
        assertTrue(picks.redPicks().contains(1));
        assertTrue(picks.redPicks().contains(2));
        assertTrue(picks.redPicks().contains(3));
        // 回测摘要应生成
        assertTrue(picks.report().backtest().evaluatedIssueCount() > 0);
        assertEquals(picks.redPicks(), historyPicks.redPicks());
        assertEquals(picks.bluePick(), historyPicks.bluePick());
    }

    @Test
    void throwsWhenHistoryTooShort() {
        SsqDrawMapper mapper = mock(SsqDrawMapper.class);
        when(mapper.selectOne(any(Wrapper.class))).thenReturn(history(5).getLast());
        when(mapper.selectRecentUpTo(anyString(), anyInt())).thenReturn(history(5));

        SsqFeatureService service = new SsqFeatureService(mapper);
        try {
            service.generatePicks(80);
            org.junit.jupiter.api.Assertions.fail("历史不足应抛异常");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("不足"));
        }
    }
}
