package com.lcbinterview.dto.tools;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.model.LotteryKl8Recommendation;

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
