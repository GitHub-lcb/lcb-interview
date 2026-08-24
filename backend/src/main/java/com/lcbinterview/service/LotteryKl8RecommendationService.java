package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import java.util.Map;

/**
 * 快乐8推荐编排服务，串联历史特征、Java 规则推荐、规则校验和历史保存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8RecommendationService {

    private static final int DEFAULT_BASE_ISSUE_COUNT = 30;
    private static final int DEFAULT_PICK_SIZE = 4;
    private static final String STRATEGY_VERSION = "KL8_JAVA_MULTI_GROUP_V20";
    private static final String DISCLAIMER = "彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。";

    private final LotteryKl8FeatureService featureService;
    private final LotteryKl8RecommendationPolicy recommendationPolicy;
    private final LotteryKl8RecommendationEvaluationService evaluationService;
    private final LotteryKl8StrategyCalibrationService calibrationService;
    private final LotteryKl8RecommendationMapper recommendationMapper;
    private final ObjectMapper objectMapper;

/**
 * 为当前用户生成 2 组快乐8选4推荐，组间覆盖去重。
 * 同一基准期只保留一条推荐：手动与自动推荐结果一致时不重复生成。
 *
 * @param userId  用户 ID
 * @param request 推荐请求
 * @return 推荐结果
 */
@Transactional
public LotteryKl8RecommendationVO recommend(Long userId, LotteryKl8RecommendationRequest request) {
    int baseIssueCount = request.baseIssueCount() == null ? DEFAULT_BASE_ISSUE_COUNT : request.baseIssueCount();
    int pickSize = DEFAULT_PICK_SIZE;
        evaluationService.evaluatePendingRecommendations();
        LotteryKl8StrategyCalibration calibration = calibrationService.currentCalibration(userId);
        Map<Integer, Double> numberHitFeedback = calibrationService.numberHitFeedback(userId);
        LotteryKl8FeatureReport report = featureService.buildReport(baseIssueCount, calibration, pickSize, numberHitFeedback);
        // 同一基准期去重：策略是确定性的，同基准期生成结果必然相同，直接复用已有推荐
        LotteryKl8Recommendation existing = findExisting(userId, report.latestIssueNo());
        if (existing != null) {
            log.info("快乐8推荐已存在，复用: userId={}, 基准期 {}", userId, report.latestIssueNo());
            return LotteryKl8RecommendationVO.from(existing, objectMapper);
        }
        String source = "RULE_BASED";
        LotteryKl8RecommendationPolicy.ValidatedRecommendation result = recommendationPolicy.fallbackResult(report, pickSize);
        LotteryKl8Recommendation recommendation = new LotteryKl8Recommendation();
        recommendation.setUserId(userId);
        recommendation.setSource(source);
        recommendation.setPickSize(pickSize);
        recommendation.setBaseIssueCount(report.baseIssueCount());
        recommendation.setLatestIssueNo(report.latestIssueNo());
        // 快乐8 每天一期：预测开奖日 = 最新已开奖日 + 1 天
        recommendation.setPredictedDrawDate(report.draws().isEmpty() ? null
                : report.draws().getFirst().getDrawDate().plusDays(1));
        recommendation.setRecommendationsJson(writeGroups(result.groups()));
        recommendation.setFeatureSummary(report.deepSummary());
        recommendation.setAnalysisJson(writeAnalysis(result, report));
        recommendation.setCandidatePoolJson(writeCandidatePool(report));
        recommendation.setCalibrationSnapshotJson(writeCalibrationSnapshot(calibration));
        recommendation.setStrategyVersion(STRATEGY_VERSION);
        recommendation.setDisclaimer(DISCLAIMER);
        recommendationMapper.insert(recommendation);
        return LotteryKl8RecommendationVO.from(recommendation, objectMapper);
    }

    /**
     * 查询用户基于指定基准期的已有推荐。
     *
     * @param userId       用户 ID
     * @param latestIssueNo 基准期号
     * @return 已有推荐，无则 null
     */
    private LotteryKl8Recommendation findExisting(Long userId, String latestIssueNo) {
        return recommendationMapper.selectOne(Wrappers.<LotteryKl8Recommendation>lambdaQuery()
                .eq(LotteryKl8Recommendation::getUserId, userId)
                .eq(LotteryKl8Recommendation::getLatestIssueNo, latestIssueNo)
                .last("LIMIT 1"));
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

    private String writeCandidatePool(LotteryKl8FeatureReport report) {
        try {
            return objectMapper.writeValueAsString(report.candidatePool());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快乐8候选池序列化失败", e);
        }
    }

    private String writeAnalysis(
            LotteryKl8RecommendationPolicy.ValidatedRecommendation result,
            LotteryKl8FeatureReport report) {
        try {
            JsonNode parsed = result.analysisJson() == null || result.analysisJson().isBlank()
                    ? objectMapper.createObjectNode()
                    : objectMapper.readTree(result.analysisJson());
            ObjectNode root = parsed.isObject() ? (ObjectNode) parsed.deepCopy() : objectMapper.createObjectNode();
            root.set("backtestSummary", objectMapper.valueToTree(report.backtestSummary()));
            root.set("optimizedPortfolio", objectMapper.valueToTree(report.optimizedPortfolio()));
            root.set("analysisSections", objectMapper.valueToTree(report.analysisSections()));
            return objectMapper.writeValueAsString(root);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快乐8深度分析序列化失败", e);
        }
    }

    private String writeCalibrationSnapshot(LotteryKl8StrategyCalibration calibration) {
        try {
            return objectMapper.writeValueAsString(calibration);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快乐8策略校准快照序列化失败", e);
        }
    }
}
