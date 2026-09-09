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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
        when(featureService.buildReport(eq(20), any(LotteryKl8StrategyCalibration.class), eq(5), any())).thenReturn(report);
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
        assertEquals("KL8_JAVA_PICK5_V21", saved.getStrategyVersion());
        assertEquals(5, saved.getPickSize());
        // 组合优化已有 1 组选5 候选，直接作为最终推荐输出 1 组，首组沿用组合优化结果
        assertEquals(1, savedGroups.size());
        assertEquals(List.of(1, 2, 3, 4, 5), savedGroups.get(0).numbers());
        assertEquals(1, result.groups().size());
        assertEquals(List.of(1, 2, 3, 4, 5), result.groups().get(0).numbers());
    }

    @Test
    void reusesExistingRecommendationWhenFormatMatches() throws Exception {
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8Recommendation existing = savedRecommendation(31L, 5, "KL8_JAVA_PICK5_V21");
        when(recommendationMapper.selectOne(any())).thenReturn(existing);

        LotteryKl8RecommendationService service = service(recommendationMapper);

        LotteryKl8RecommendationVO result = service.recommend(7L, new LotteryKl8RecommendationRequest(null));

        assertEquals(5, result.pickSize());
        assertEquals(List.of(1, 2, 3, 4, 5), result.groups().get(0).numbers());
        // 口径一致：既不新增也不覆盖
        verify(recommendationMapper, never()).insert(any());
        verify(recommendationMapper, never()).updateById(any());
    }

    @Test
    void overwritesUnsettledLegacyPick4RecommendationInPlace() {
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8Recommendation existing = savedRecommendation(31L, 4, "KL8_JAVA_MULTI_GROUP_V20");
        when(recommendationMapper.selectOne(any())).thenReturn(existing);

        LotteryKl8RecommendationService service = service(recommendationMapper);

        LotteryKl8RecommendationVO result = service.recommend(7L, new LotteryKl8RecommendationRequest(null));

        // 同一基准期、未结算、口径不同：原地覆盖为选5，避免页面继续显示旧选4 推荐
        assertEquals(5, result.pickSize());
        assertEquals(5, result.groups().get(0).numbers().size());
        ArgumentCaptor<LotteryKl8Recommendation> captor = ArgumentCaptor.forClass(LotteryKl8Recommendation.class);
        verify(recommendationMapper).updateById(captor.capture());
        assertEquals(31L, captor.getValue().getId());
        assertEquals(5, captor.getValue().getPickSize());
        assertEquals("KL8_JAVA_PICK5_V21", captor.getValue().getStrategyVersion());
        verify(recommendationMapper, never()).insert(any());
    }

    @Test
    void keepsSettledLegacyRecommendationAndInsertsNewOne() {
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8Recommendation existing = savedRecommendation(31L, 4, "KL8_JAVA_MULTI_GROUP_V20");
        existing.setEvaluatedIssueNo("2026168");
        when(recommendationMapper.selectOne(any())).thenReturn(existing);
        when(recommendationMapper.insert(any())).thenAnswer(invocation -> {
            LotteryKl8Recommendation recommendation = invocation.getArgument(0);
            recommendation.setId(32L);
            return 1;
        });

        LotteryKl8RecommendationService service = service(recommendationMapper);

        LotteryKl8RecommendationVO result = service.recommend(7L, new LotteryKl8RecommendationRequest(null));

        // 已结算的旧记录保留作历史，另存一条选5 新记录
        assertEquals(32L, result.id());
        assertEquals(5, result.pickSize());
        verify(recommendationMapper).insert(any());
        verify(recommendationMapper, never()).updateById(any());
    }

    @Test
    void overwritesLegacyRecommendationWhenEvaluatedIssueIsBlank() {
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8Recommendation existing = savedRecommendation(31L, 4, "KL8_JAVA_MULTI_GROUP_V20");
        // 线上历史数据里未结算记录的结算期号是空串，不是 NULL
        existing.setEvaluatedIssueNo("");
        when(recommendationMapper.selectOne(any())).thenReturn(existing);

        LotteryKl8RecommendationService service = service(recommendationMapper);

        LotteryKl8RecommendationVO result = service.recommend(7L, new LotteryKl8RecommendationRequest(null));

        assertEquals(5, result.pickSize());
        verify(recommendationMapper).updateById(any());
        verify(recommendationMapper, never()).insert(any());
    }

    @Test
    void hasCurrentRecommendationRequiresPick5AndCurrentVersion() {
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8RecommendationService service = service(recommendationMapper);

        when(recommendationMapper.selectOne(any())).thenReturn(savedRecommendation(31L, 5, "KL8_JAVA_PICK5_V21"));
        assertTrue(service.hasCurrentRecommendation(7L, "2026168"));

        when(recommendationMapper.selectOne(any())).thenReturn(savedRecommendation(31L, 4, "KL8_JAVA_PICK5_V21"));
        assertFalse(service.hasCurrentRecommendation(7L, "2026168"));

        when(recommendationMapper.selectOne(any())).thenReturn(savedRecommendation(31L, 5, "KL8_JAVA_MULTI_GROUP_V20"));
        assertFalse(service.hasCurrentRecommendation(7L, "2026168"));

        when(recommendationMapper.selectOne(any())).thenReturn(null);
        assertFalse(service.hasCurrentRecommendation(7L, "2026168"));
    }

    private LotteryKl8RecommendationService service(LotteryKl8RecommendationMapper recommendationMapper) {
        LotteryKl8FeatureService featureService = mock(LotteryKl8FeatureService.class);
        LotteryKl8RecommendationPolicy recommendationPolicy = new LotteryKl8RecommendationPolicy(objectMapper);
        LotteryKl8RecommendationEvaluationService evaluationService = mock(LotteryKl8RecommendationEvaluationService.class);
        LotteryKl8StrategyCalibrationService calibrationService = mock(LotteryKl8StrategyCalibrationService.class);
        when(calibrationService.currentCalibration(7L)).thenReturn(LotteryKl8StrategyCalibration.neutral());
        when(calibrationService.numberHitFeedback(7L)).thenReturn(Map.of());
        when(featureService.buildReport(eq(20), any(LotteryKl8StrategyCalibration.class), eq(5), any()))
                .thenReturn(reportWithSingleOptimizedGroup());
        return new LotteryKl8RecommendationService(
                featureService,
                recommendationPolicy,
                evaluationService,
                calibrationService,
                recommendationMapper,
                objectMapper);
    }

    private LotteryKl8Recommendation savedRecommendation(Long id, Integer pickSize, String strategyVersion) {
        LotteryKl8Recommendation recommendation = new LotteryKl8Recommendation();
        recommendation.setId(id);
        recommendation.setUserId(7L);
        recommendation.setPickSize(pickSize);
        recommendation.setStrategyVersion(strategyVersion);
        recommendation.setLatestIssueNo("2026168");
        recommendation.setRecommendationsJson("[{\"numbers\":[1,2,3,4,5],\"reason\":\"旧记录\"}]");
        return recommendation;
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
