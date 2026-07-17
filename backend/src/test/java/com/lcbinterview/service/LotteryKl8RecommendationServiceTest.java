package com.lcbinterview.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationVO;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.LotteryKl8Recommendation;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LotteryKl8RecommendationServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void recommendUsesJavaPolicyWithoutCallingAi() throws Exception {
        LotteryKl8FeatureService featureService = mock(LotteryKl8FeatureService.class);
        LotteryKl8RecommendationPolicy recommendationPolicy = new LotteryKl8RecommendationPolicy(objectMapper);
        LotteryKl8RecommendationEvaluationService evaluationService = mock(LotteryKl8RecommendationEvaluationService.class);
        LotteryKl8StrategyCalibrationService calibrationService = mock(LotteryKl8StrategyCalibrationService.class);
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8StrategyCalibration calibration = LotteryKl8StrategyCalibration.neutral();
        LotteryKl8FeatureReport report = reportWithSingleOptimizedGroup();
        when(calibrationService.currentCalibration(7L)).thenReturn(calibration);
        when(calibrationService.numberHitFeedback(7L)).thenReturn(Map.of());
        when(featureService.buildReport(eq(100), any(LotteryKl8StrategyCalibration.class), eq(5), any())).thenReturn(report);
        when(recommendationMapper.insert(any())).thenAnswer(invocation -> {
            LotteryKl8Recommendation recommendation = invocation.getArgument(0);
            recommendation.setId(99L);
            return 1;
        });
        LotteryKl8RecommendationService service = new LotteryKl8RecommendationService(
                featureService,
                recommendationPolicy,
                evaluationService,
                calibrationService,
                recommendationMapper,
                objectMapper);

        LotteryKl8RecommendationVO result = service.recommend(7L, new LotteryKl8RecommendationRequest(null));

        verify(evaluationService).evaluatePendingRecommendations();
        assertTrue(Arrays.stream(LotteryKl8RecommendationService.class.getDeclaredFields())
                .noneMatch(field -> field.getType().equals(LotteryKl8AiRecommendationService.class)));
        ArgumentCaptor<LotteryKl8Recommendation> captor = ArgumentCaptor.forClass(LotteryKl8Recommendation.class);
        verify(recommendationMapper).insert(captor.capture());
        LotteryKl8Recommendation saved = captor.getValue();
        List<LotteryKl8RecommendationGroupVO> savedGroups = objectMapper.readValue(
                saved.getRecommendationsJson(), new TypeReference<>() {
                });
        assertEquals("RULE_BASED", saved.getSource());
        assertEquals("KL8_JAVA_HOT_FREQ_W100_V15", saved.getStrategyVersion());
        assertEquals(1, savedGroups.size());
        assertEquals(List.of(1, 2, 3, 4, 5), savedGroups.get(0).numbers());
        assertEquals(1, result.groups().size());
        assertEquals(List.of(1, 2, 3, 4, 5), result.groups().get(0).numbers());
    }

    private LotteryKl8FeatureReport reportWithSingleOptimizedGroup() {
        return new LotteryKl8FeatureReport(
                1000,
                "2026168",
                List.of(1, 2, 3, 4, 5, 6, 7, 8),
                List.of(70, 71, 72, 73, 74, 75, 76, 77),
                missingMap(),
                Map.of("1-20", 100, "21-40", 100, "41-60", 100, "61-80", 100),
                Map.of(),
                Map.of(),
                1000,
                1000,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                LotteryKl8BacktestSummary.empty(),
                new LotteryKl8OptimizedPortfolio(
                        List.of(new LotteryKl8OptimizedGroup(List.of(1, 2, 3, 4, 5), 90, "Java 组合优化", List.of("测试证据"))),
                        "Java 组合优化测试",
                        Map.of("groupCount", "1")),
                List.of("组合层：Java 组合优化测试"),
                "测试摘要",
                "测试深度摘要");
    }

    private Map<Integer, Integer> missingMap() {
        Map<Integer, Integer> values = new LinkedHashMap<>();
        for (int i = 1; i <= 80; i += 1) {
            values.put(i, i);
        }
        return values;
    }

}
