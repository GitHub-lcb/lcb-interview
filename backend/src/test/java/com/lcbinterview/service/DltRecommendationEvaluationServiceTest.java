package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.DltRecommendationMapper;
import com.lcbinterview.model.DltDraw;
import com.lcbinterview.model.DltRecommendation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DltRecommendationEvaluationServiceTest {

    private DltDraw draw(String issueNo, String fronts, String backs) {
        DltDraw draw = new DltDraw();
        draw.setIssueNo(issueNo);
        draw.setDrawDate(LocalDate.now());
        draw.setFrontNumbers(fronts);
        draw.setBackNumbers(backs);
        return draw;
    }

    private DltRecommendation recommendation(String latestIssueNo, String fronts, String backs) {
        DltRecommendation recommendation = new DltRecommendation();
        recommendation.setId(1L);
        recommendation.setLatestIssueNo(latestIssueNo);
        recommendation.setFrontNumbers(fronts);
        recommendation.setBackNumbers(backs);
        return recommendation;
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void settlesFrontAndBackHits() {
        DltRecommendationMapper recommendationMapper = mock(DltRecommendationMapper.class);
        DltDrawMapper drawMapper = mock(DltDrawMapper.class);
        DltRecommendationEvaluationService service = new DltRecommendationEvaluationService(
                recommendationMapper, drawMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        when(recommendationMapper.selectList(any(Wrapper.class))).thenReturn(List.of(
                recommendation("26091", "1,2,3,4,5", "7,9,12")));
        when(drawMapper.selectOne(any(Wrapper.class)))
                .thenReturn(draw("26092", "1,2,3,10,11", "7,9"));

        int evaluated = service.evaluatePendingRecommendations();

        assertEquals(1, evaluated);
        verify(recommendationMapper).updateById(any());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void evaluatesSingleRecommendation() {
        DltRecommendationMapper recommendationMapper = mock(DltRecommendationMapper.class);
        DltDrawMapper drawMapper = mock(DltDrawMapper.class);
        DltRecommendationEvaluationService service = new DltRecommendationEvaluationService(
                recommendationMapper, drawMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        DltRecommendation recommendation = recommendation("26091", "1,2,3,4,5", "7,9,12");
        service.evaluateRecommendation(recommendation, draw("26092", "1,2,3,10,11", "7,9"));

        assertEquals("26092", recommendation.getEvaluatedIssueNo());
        // 前区 1、2、3 命中 3 个，后区 7、9 命中 2 个，总命中 5
        assertEquals(3, recommendation.getMaxHitCount());
        assertEquals(5, recommendation.getTotalHitCount());
        assertTrue(recommendation.getHitSummaryJson().contains("\"frontHitCount\":3"));
        assertTrue(recommendation.getHitSummaryJson().contains("\"backHitCount\":2"));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void skipsWhenNextDrawMissing() {
        DltRecommendationMapper recommendationMapper = mock(DltRecommendationMapper.class);
        DltDrawMapper drawMapper = mock(DltDrawMapper.class);
        DltRecommendationEvaluationService service = new DltRecommendationEvaluationService(
                recommendationMapper, drawMapper, new com.fasterxml.jackson.databind.ObjectMapper());

        when(recommendationMapper.selectList(any(Wrapper.class))).thenReturn(List.of(
                recommendation("26092", "1,2,3,4,5", "7,9,12")));
        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(null);

        assertEquals(0, service.evaluatePendingRecommendations());
    }
}
