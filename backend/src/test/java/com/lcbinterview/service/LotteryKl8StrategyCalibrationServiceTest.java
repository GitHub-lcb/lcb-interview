package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.LotteryKl8Recommendation;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LotteryKl8StrategyCalibrationServiceTest {

    @Test
    void buildsCalibrationFromEvaluatedRecommendationHits() {
        LotteryKl8RecommendationMapper mapper = mock(LotteryKl8RecommendationMapper.class);
        when(mapper.selectList(any())).thenReturn(List.of(evaluatedRecommendation()));
        LotteryKl8StrategyCalibrationService service =
                new LotteryKl8StrategyCalibrationService(mapper, new ObjectMapper());

        LotteryKl8StrategyCalibration calibration = service.currentCalibration();

        assertEquals(1, calibration.evaluatedCount());
        assertTrue(calibration.hotMultiplier() > 1.0);
        assertTrue(calibration.missingMultiplier() > 1.0);
        assertTrue(calibration.trendMultiplier() > 1.0);
        assertTrue(calibration.pairMultiplier() > 1.0);
        assertTrue(calibration.summary().contains("历史命中反馈"));
        assertTrue(calibration.summary().contains("对子"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void userCalibrationFallsBackToGlobalWhenInsufficient() {
        LotteryKl8RecommendationMapper mapper = mock(LotteryKl8RecommendationMapper.class);
        // 第一次调用（用户级）返回空列表，第二次调用（全局）返回有效数据
        when(mapper.selectList(any())).thenReturn(List.of(), List.of(evaluatedRecommendation()));
        LotteryKl8StrategyCalibrationService service =
                new LotteryKl8StrategyCalibrationService(mapper, new ObjectMapper());

        LotteryKl8StrategyCalibration calibration = service.currentCalibration(42L);

        // 用户样本不足 10 条，回退全局后应返回有效校准
        assertEquals(1, calibration.evaluatedCount());
        assertTrue(calibration.hotMultiplier() > 1.0);
    }

    @Test
    void numberHitFeedbackTracksPerNumberHitRate() {
        LotteryKl8RecommendationMapper mapper = mock(LotteryKl8RecommendationMapper.class);
        when(mapper.selectList(any())).thenReturn(List.of(evaluatedRecommendation()));
        LotteryKl8StrategyCalibrationService service =
                new LotteryKl8StrategyCalibrationService(mapper, new ObjectMapper());

        Map<Integer, Double> feedback = service.numberHitFeedback(null);

        // 号码 1 在 5 组推荐中全部命中，命中率 100%，反馈分应为正值
        assertTrue(feedback.containsKey(1));
        assertTrue(feedback.get(1) > 0, "命中率高于随机基线的号码应有正反馈分");
        // 号码 60 从未命中，反馈分应为负值
        assertTrue(feedback.containsKey(60));
        assertTrue(feedback.get(60) < 0, "从未命中的号码应有负反馈分");
        // 号码 1 的反馈分应高于号码 60
        assertTrue(feedback.get(1) > feedback.get(60));
    }

    @Test
    void numberHitFeedbackReturnsEmptyWhenNoEvaluatedRecords() {
        LotteryKl8RecommendationMapper mapper = mock(LotteryKl8RecommendationMapper.class);
        when(mapper.selectList(any())).thenReturn(List.of());
        LotteryKl8StrategyCalibrationService service =
                new LotteryKl8StrategyCalibrationService(mapper, new ObjectMapper());

        Map<Integer, Double> feedback = service.numberHitFeedback(null);

        assertTrue(feedback.isEmpty());
    }

    private LotteryKl8Recommendation evaluatedRecommendation() {
        LotteryKl8Recommendation recommendation = new LotteryKl8Recommendation();
        recommendation.setId(1L);
        recommendation.setEvaluatedAt(LocalDateTime.now());
        recommendation.setCandidatePoolJson("""
                [
                  {"number":1,"score":90,"roles":["热号"],"evidence":"热号"},
                  {"number":80,"score":88,"roles":["高遗漏"],"evidence":"高遗漏"},
                  {"number":34,"score":87,"roles":["近期上行"],"evidence":"趋势"},
                  {"number":50,"score":70,"roles":["均衡补位"],"evidence":"均衡"}
                ]
                """);
        recommendation.setRecommendationsJson("""
                [
                  {"numbers":[1,80,34,50,60],"reason":"A"},
                  {"numbers":[1,80,34,51,61],"reason":"B"},
                  {"numbers":[1,80,34,52,62],"reason":"C"},
                  {"numbers":[1,80,34,53,63],"reason":"D"},
                  {"numbers":[1,80,34,54,64],"reason":"E"}
                ]
                """);
        recommendation.setHitSummaryJson("""
                {
                  "issueNo":"2026169",
                  "drawDate":"2026-06-28",
                  "totalHitCount":15,
                  "maxHitCount":3,
                  "pairs":[
                    {"pairIndex":1,"numbers":[1,80],"hitNumbers":[1,80],"hitCount":2,"fullHit":true},
                    {"pairIndex":2,"numbers":[34,50],"hitNumbers":[34],"hitCount":1,"fullHit":false}
                  ],
                  "groups":[
                    {"groupIndex":1,"numbers":[1,80,34,50,60],"hitNumbers":[1,80,34],"hitCount":3},
                    {"groupIndex":2,"numbers":[1,80,34,51,61],"hitNumbers":[1,80,34],"hitCount":3},
                    {"groupIndex":3,"numbers":[1,80,34,52,62],"hitNumbers":[1,80,34],"hitCount":3},
                    {"groupIndex":4,"numbers":[1,80,34,53,63],"hitNumbers":[1,80,34],"hitCount":3},
                    {"groupIndex":5,"numbers":[1,80,34,54,64],"hitNumbers":[1,80,34],"hitCount":3}
                  ]
                }
                """);
        return recommendation;
    }
}
