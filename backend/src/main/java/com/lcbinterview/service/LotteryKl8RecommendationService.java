package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationVO;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.LotteryKl8Recommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 快乐8推荐编排服务，串联历史特征、AI 推荐、规则校验和历史保存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8RecommendationService {

    private static final int DEFAULT_BASE_ISSUE_COUNT = 100;
    private static final String DISCLAIMER = "彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。";

    private final LotteryKl8FeatureService featureService;
    private final LotteryKl8AiRecommendationService aiRecommendationService;
    private final LotteryKl8RecommendationPolicy recommendationPolicy;
    private final LotteryKl8RecommendationMapper recommendationMapper;
    private final ObjectMapper objectMapper;

    /**
     * 为当前用户生成 5 组快乐8选5推荐。
     *
     * @param userId  用户 ID
     * @param request 推荐请求
     * @return 推荐结果
     */
    @Transactional
    public LotteryKl8RecommendationVO recommend(Long userId, LotteryKl8RecommendationRequest request) {
        int baseIssueCount = request.baseIssueCount() == null ? DEFAULT_BASE_ISSUE_COUNT : request.baseIssueCount();
        LotteryKl8FeatureReport report = featureService.buildReport(baseIssueCount);
        String source = "AI";
        List<LotteryKl8RecommendationGroupVO> groups;
        try {
            groups = recommendationPolicy.validateAiContent(aiRecommendationService.recommend(report));
        } catch (Exception e) {
            log.warn("快乐8 AI 推荐不可用，回退规则推荐: {}", e.getMessage());
            source = "RULE_BASED";
            groups = recommendationPolicy.fallbackGroups(report);
        }
        LotteryKl8Recommendation recommendation = new LotteryKl8Recommendation();
        recommendation.setUserId(userId);
        recommendation.setSource(source);
        recommendation.setBaseIssueCount(report.baseIssueCount());
        recommendation.setLatestIssueNo(report.latestIssueNo());
        recommendation.setRecommendationsJson(writeGroups(groups));
        recommendation.setFeatureSummary(report.summary());
        recommendation.setDisclaimer(DISCLAIMER);
        recommendationMapper.insert(recommendation);
        return LotteryKl8RecommendationVO.from(recommendation, objectMapper);
    }

    /**
     * 分页查询当前用户的推荐历史。
     *
     * @param userId 用户 ID
     * @param page   页码
     * @param size   每页条数
     * @return 推荐历史
     */
    @Transactional(readOnly = true)
    public PageResult<LotteryKl8RecommendationVO> list(Long userId, int page, int size) {
        Page<LotteryKl8Recommendation> request = new Page<>(Math.max(0, page) + 1L, Math.min(50, Math.max(1, size)));
        Page<LotteryKl8Recommendation> result = recommendationMapper.selectPage(request,
                Wrappers.<LotteryKl8Recommendation>lambdaQuery()
                        .eq(LotteryKl8Recommendation::getUserId, userId)
                        .orderByDesc(LotteryKl8Recommendation::getCreateTime));
        return PageResult.of(result, result.getRecords().stream()
                .map(item -> LotteryKl8RecommendationVO.from(item, objectMapper))
                .toList());
    }

    private String writeGroups(List<LotteryKl8RecommendationGroupVO> groups) {
        try {
            return objectMapper.writeValueAsString(groups);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快乐8推荐结果序列化失败", e);
        }
    }
}
