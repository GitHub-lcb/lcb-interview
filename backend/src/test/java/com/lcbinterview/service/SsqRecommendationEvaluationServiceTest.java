package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.mapper.SsqRecommendationMapper;
import com.lcbinterview.model.SsqDraw;
import com.lcbinterview.model.SsqRecommendation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SsqRecommendationEvaluationServiceTest {

    private SsqDraw draw(String issueNo, String reds, String blue) {
        SsqDraw draw = new SsqDraw();
        draw.setIssueNo(issueNo);
        draw.setDrawDate(LocalDate.now());
        draw.setRedNumbers(reds);
        draw.setBlueNumber(blue);
        return draw;
    }

    private SsqRecommendation recommendation(String latestIssueNo, String reds, String blue) {
        SsqRecommendation recommendation = new SsqRecommendation();
        recommendation.setId(1L);
        recommendation.setLatestIssueNo(latestIssueNo);
        recommendation.setRedNumbers(reds);
        recommendation.setBlueNumber(blue);
        return recommendation;
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void settlesHitAndMiss() {
        SsqRecommendationMapper recommendationMapper = mock(SsqRecommendationMapper.class);
        SsqDrawMapper drawMapper = mock(SsqDrawMapper.class);
        SsqRecommendationEvaluationService service = new SsqRecommendationEvaluationService(
                recommendationMapper, drawMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        when(recommendationMapper.selectList(any(Wrapper.class))).thenReturn(List.of(
                recommendation("2026093", "1,2,3,4,5,6,7", "5"),
                recommendation("2026093", "10,20,30,11,21,31,32", "16")));
        when(drawMapper.selectOne(any(Wrapper.class)))
                .thenReturn(draw("2026094", "1,2,3,8,9,10", "5"));

        int evaluated = service.evaluatePendingRecommendations();

        assertEquals(2, evaluated);
        verify(recommendationMapper, org.mockito.Mockito.times(2)).updateById(any());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void evaluatesSingleRecommendation() {
        SsqRecommendationMapper recommendationMapper = mock(SsqRecommendationMapper.class);
        SsqDrawMapper drawMapper = mock(SsqDrawMapper.class);
        SsqRecommendationEvaluationService service = new SsqRecommendationEvaluationService(
                recommendationMapper, drawMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        SsqRecommendation recommendation = recommendation("2026093", "1,2,3,4,5,6,7", "5");
        service.evaluateRecommendation(recommendation, draw("2026094", "1,2,3,8,9,10", "5"));

        assertEquals("2026094", recommendation.getEvaluatedIssueNo());
        // 红球 1、2、3 命中 3 个，蓝球 5 命中，总命中 4
        assertEquals(3, recommendation.getMaxHitCount());
        assertEquals(4, recommendation.getTotalHitCount());
        assertTrue(recommendation.getHitSummaryJson().contains("\"redHitCount\":3"));
        assertTrue(recommendation.getHitSummaryJson().contains("\"blueHit\":true"));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void skipsWhenNextDrawMissing() {
        SsqRecommendationMapper recommendationMapper = mock(SsqRecommendationMapper.class);
        SsqDrawMapper drawMapper = mock(SsqDrawMapper.class);
        SsqRecommendationEvaluationService service = new SsqRecommendationEvaluationService(
                recommendationMapper, drawMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        when(recommendationMapper.selectList(any(Wrapper.class))).thenReturn(List.of(
                recommendation("2026094", "1,2,3,4,5,6,7", "5")));
        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(null);

        assertEquals(0, service.evaluatePendingRecommendations());
    }
}
