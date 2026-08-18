package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.DltRecommendationVO;
import com.lcbinterview.mapper.DltRecommendationMapper;
import com.lcbinterview.model.DltRecommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 大乐透推荐编排服务：串联特征计算、推荐生成与历史保存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DltRecommendationService {

    private static final int DEFAULT_BASE_ISSUE_COUNT = 100;
    private static final String STRATEGY_VERSION = "DLT_FRONT5_BACK3_V1";
    private static final String DISCLAIMER = "彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。";

    private final DltFeatureService featureService;
    private final DltRecommendationMapper recommendationMapper;
    private final ObjectMapper objectMapper;

    /**
     * 为当前用户生成 5 前区 + 3 后区大乐透推荐并保存。
     * 同一基准期只保留一条推荐：手动与自动推荐结果一致时不重复生成。
     *
     * @param userId          用户 ID
     * @param baseIssueCount  使用历史期数，空则用默认值
     * @return 推荐结果
     */
    @Transactional
    public DltRecommendationVO recommend(Long userId, Integer baseIssueCount) {
        int window = baseIssueCount == null ? DEFAULT_BASE_ISSUE_COUNT : baseIssueCount;
        DltFeatureService.DltPicks picks = featureService.generatePicks(window);
        DltFeatureService.DltFeatureReport report = picks.report();

        DltRecommendation existing = findExisting(userId, report.latestIssueNo());
        if (existing != null) {
            log.info("大乐透推荐已存在，复用: userId={}, 基准期 {}", userId, report.latestIssueNo());
            return toVo(existing);
        }

        DltRecommendation recommendation = new DltRecommendation();
        recommendation.setUserId(userId);
        recommendation.setSource("RULE_BASED");
        recommendation.setFrontNumbers(picks.frontPicks().stream().map(String::valueOf).collect(Collectors.joining(",")));
        recommendation.setBackNumbers(picks.backPicks().stream().map(String::valueOf).collect(Collectors.joining(",")));
        recommendation.setBaseIssueCount(window);
        recommendation.setLatestIssueNo(report.latestIssueNo());
        // 大乐透每周一三六开奖：预测开奖日 = 最新已开奖日之后最近的开奖日
        recommendation.setPredictedDrawDate(nextDrawDate(report.latestDrawDate()));
        recommendation.setFeatureSummary(report.deepSummary());
        recommendation.setAnalysisJson(buildAnalysisJson(report));
        recommendation.setDisclaimer(DISCLAIMER);
        recommendationMapper.insert(recommendation);
        log.info("大乐透推荐生成: userId={}, 前区={}, 后区={}, 基准期 {}",
                userId, picks.frontPicks(), picks.backPicks(), report.latestIssueNo());
        return toVo(recommendation);
    }

    /**
     * 查询用户基于指定基准期的已有推荐。
     */
    private DltRecommendation findExisting(Long userId, String latestIssueNo) {
        return recommendationMapper.selectOne(Wrappers.<DltRecommendation>lambdaQuery()
                .eq(DltRecommendation::getUserId, userId)
                .eq(DltRecommendation::getLatestIssueNo, latestIssueNo)
                .last("LIMIT 1"));
    }

    /**
     * 计算最新已开奖日之后最近的开奖日（周一/三/六）。
     *
     * @param latestDrawDate 最新已开奖日期
     * @return 预测开奖日期
     */
    static java.time.LocalDate nextDrawDate(java.time.LocalDate latestDrawDate) {
        java.time.LocalDate date = latestDrawDate.plusDays(1);
        while (date.getDayOfWeek() != java.time.DayOfWeek.MONDAY
                && date.getDayOfWeek() != java.time.DayOfWeek.WEDNESDAY
                && date.getDayOfWeek() != java.time.DayOfWeek.SATURDAY) {
            date = date.plusDays(1);
        }
        return date;
    }

    /**
     * 分页查询当前用户的大乐透推荐历史。
     *
     * @param userId 用户 ID
     * @param page   页码
     * @param size   每页条数
     * @return 推荐历史分页
     */
    @Transactional(readOnly = true)
    public PageResult<DltRecommendationVO> list(Long userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        Page<DltRecommendation> result = recommendationMapper.selectPage(new Page<>(safePage + 1L, safeSize),
                Wrappers.<DltRecommendation>lambdaQuery()
                        .eq(DltRecommendation::getUserId, userId)
                        .orderByDesc(DltRecommendation::getCreateTime));
        return PageResult.of(result, result.getRecords().stream().map(this::toVo).toList());
    }

    private String buildAnalysisJson(DltFeatureService.DltFeatureReport report) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("strategyVersion", STRATEGY_VERSION);
        root.put("confidenceLabel", "中低");
        ObjectNode backtest = root.putObject("backtestSummary");
        backtest.put("evaluatedIssueCount", report.backtest().evaluatedIssueCount());
        backtest.put("averageFrontHit", report.backtest().averageFrontHit());
        backtest.put("averageBackHit", report.backtest().averageBackHit());
        backtest.put("summary", report.backtest().summary());
        ArrayNode distribution = backtest.putArray("frontHitDistribution");
        for (int hit = 0; hit <= 5; hit += 1) {
            distribution.add(report.backtest().frontHitDistribution().getOrDefault(hit, 0));
        }
        ObjectNode analysis = root.putObject("analysis");
        analysis.put("overview", report.deepSummary());
        ArrayNode warnings = analysis.putArray("riskWarnings");
        warnings.add("彩票开奖结果独立随机，历史统计不能保证命中。");
        warnings.add("大乐透 5+3 复式：前区 5 个单式，后区 3 选 2 复式共 3 注 6 元，请理性购彩。");
        return root.toString();
    }

    private DltRecommendationVO toVo(DltRecommendation entity) {
        return new DltRecommendationVO(
                entity.getId(),
                entity.getSource(),
                parseNumbers(entity.getFrontNumbers()),
                parseNumbers(entity.getBackNumbers()),
                entity.getBaseIssueCount(),
                entity.getLatestIssueNo(),
                entity.getFeatureSummary(),
                entity.getAnalysisJson(),
                entity.getEvaluatedIssueNo(),
                entity.getEvaluatedDrawDate(),
                entity.getPredictedDrawDate(),
                entity.getTotalHitCount(),
                entity.getMaxHitCount(),
                entity.getHitSummaryJson(),
                entity.getDisclaimer(),
                entity.getCreateTime());
    }

    private List<Integer> parseNumbers(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<Integer> numbers = new ArrayList<>();
        for (String part : value.split(",")) {
            try {
                numbers.add(Integer.parseInt(part.trim()));
            } catch (NumberFormatException ignored) {
                // 脏数据跳过
            }
        }
        return numbers;
    }
}
