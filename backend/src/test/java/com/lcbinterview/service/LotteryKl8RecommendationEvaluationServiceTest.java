package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import com.lcbinterview.model.LotteryKl8Recommendation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class LotteryKl8RecommendationEvaluationServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void evaluatesRecommendationAgainstNextDraw() {
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationEvaluationService service =
                new LotteryKl8RecommendationEvaluationService(recommendationMapper, drawMapper, objectMapper);

        LotteryKl8Recommendation recommendation = recommendation();
        LotteryKl8Draw draw = draw();

        LotteryKl8RecommendationEvaluationResult result = service.evaluateRecommendation(recommendation, draw);

        assertEquals("2026169", result.issueNo());
        assertEquals(10, result.totalHitCount());
        assertEquals(3, result.maxHitCount());
        assertEquals(5, result.groups().size());
        assertTrue(result.groups().get(0).hitNumbers().contains(1));
        assertTrue(result.groups().get(0).hitNumbers().contains(23));
        assertTrue(result.groups().get(0).hitNumbers().contains(67));
        assertEquals("2026169", recommendation.getEvaluatedIssueNo());
        assertEquals(LocalDate.of(2026, 6, 28), recommendation.getEvaluatedDrawDate());
        assertEquals(10, recommendation.getTotalHitCount());
        assertEquals(3, recommendation.getMaxHitCount());
        assertNotNull(recommendation.getEvaluatedAt());
        assertTrue(recommendation.getHitSummaryJson().contains("\"maxHitCount\":3"));
        assertTrue(recommendation.getHitSummaryJson().contains("\"pairs\""));
        assertTrue(recommendation.getHitSummaryJson().contains("\"fullHit\":true"));
        assertTrue(recommendation.getHitSummaryJson().contains("\"fullHit\":false"));
        verify(recommendationMapper).updateById(recommendation);
    }

    private LotteryKl8Recommendation recommendation() {
        LotteryKl8Recommendation recommendation = new LotteryKl8Recommendation();
        recommendation.setId(10L);
        recommendation.setLatestIssueNo("2026168");
        recommendation.setRecommendationsJson("""
                [
                  {"numbers":[1,8,23,45,67],"reason":"A"},
                  {"numbers":[2,16,31,52,80],"reason":"B"},
                  {"numbers":[3,19,34,58,72],"reason":"C"},
                  {"numbers":[5,22,39,48,64],"reason":"D"},
                  {"numbers":[7,27,43,60,75],"reason":"E"}
                ]
                """);
        recommendation.setAnalysisJson("""
                {
                  "optimizedPortfolio": {
                    "pairRecommendations": [
                      {"leftNumber":1,"rightNumber":23,"count":20,"lift":1.2,"score":98,"selected":true,"reason":"核心对子","evidence":["测试"]},
                      {"leftNumber":45,"rightNumber":67,"count":18,"lift":1.1,"score":88,"selected":true,"reason":"核心对子","evidence":["测试"]},
                      {"leftNumber":2,"rightNumber":16,"count":18,"lift":1.1,"score":80,"selected":false,"reason":"备选对子","evidence":["测试"]}
                    ]
                  }
                }
                """);
        return recommendation;
    }

    private LotteryKl8Draw draw() {
        LotteryKl8Draw draw = new LotteryKl8Draw();
        draw.setIssueNo("2026169");
        draw.setDrawDate(LocalDate.of(2026, 6, 28));
        draw.setNumbers("1,2,4,9,16,23,29,34,41,43,50,52,59,60,67,69,70,71,72,79");
        return draw;
    }
}
