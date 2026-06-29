package com.lcbinterview.dto.tools;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.model.LotteryKl8Recommendation;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 快乐8选5推荐展示对象。
 *
 * @param id             推荐 ID
 * @param source         推荐来源
 * @param baseIssueCount 使用历史期数
 * @param latestIssueNo  最新期号
 * @param groups         5 组推荐号码
 * @param featureSummary 特征摘要
 * @param analysisJson   深度分析 JSON
 * @param candidatePoolJson 候选池 JSON
 * @param calibrationSnapshotJson 策略校准快照 JSON
 * @param strategyVersion 策略版本
 * @param evaluatedIssueNo 结算开奖期号
 * @param evaluatedDrawDate 结算开奖日期
 * @param hitSummaryJson 命中结果 JSON
 * @param totalHitCount 5 组累计命中数量
 * @param maxHitCount 单组最高命中数量
 * @param evaluatedAt 命中结算时间
 * @param disclaimer     风险提示
 * @param createdAt      创建时间
 */
public record LotteryKl8RecommendationVO(
        Long id,
        String source,
        Integer baseIssueCount,
        String latestIssueNo,
        List<LotteryKl8RecommendationGroupVO> groups,
        String featureSummary,
        String analysisJson,
        String candidatePoolJson,
        String calibrationSnapshotJson,
        String strategyVersion,
        String evaluatedIssueNo,
        LocalDate evaluatedDrawDate,
        String hitSummaryJson,
        Integer totalHitCount,
        Integer maxHitCount,
        LocalDateTime evaluatedAt,
        String disclaimer,
        LocalDateTime createdAt
) {

    /**
     * 从推荐历史实体创建展示对象。
     *
     * @param recommendation 推荐历史实体
     * @param objectMapper   JSON 解析器
     * @return 推荐展示对象
     */
    public static LotteryKl8RecommendationVO from(
            LotteryKl8Recommendation recommendation,
            ObjectMapper objectMapper) {
        return new LotteryKl8RecommendationVO(
                recommendation.getId(),
                recommendation.getSource(),
                recommendation.getBaseIssueCount(),
                recommendation.getLatestIssueNo(),
                parseGroups(recommendation.getRecommendationsJson(), objectMapper),
                recommendation.getFeatureSummary(),
                recommendation.getAnalysisJson(),
                recommendation.getCandidatePoolJson(),
                recommendation.getCalibrationSnapshotJson(),
                recommendation.getStrategyVersion(),
                recommendation.getEvaluatedIssueNo(),
                recommendation.getEvaluatedDrawDate(),
                recommendation.getHitSummaryJson(),
                recommendation.getTotalHitCount(),
                recommendation.getMaxHitCount(),
                recommendation.getEvaluatedAt(),
                recommendation.getDisclaimer(),
                recommendation.getCreateTime());
    }

    private static List<LotteryKl8RecommendationGroupVO> parseGroups(String json, ObjectMapper objectMapper) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            return List.of();
        }
    }
}
