package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.SsqRecommendationVO;
import com.lcbinterview.mapper.SsqRecommendationMapper;
import com.lcbinterview.model.SsqRecommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 双色球推荐编排服务：串联特征计算、推荐生成与历史保存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SsqRecommendationService {

    private static final int DEFAULT_BASE_ISSUE_COUNT = 100;
    private static final String STRATEGY_VERSION = "SSQ_RED7_BLUE1_V1";
    private static final String DISCLAIMER = "彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。";

    private final SsqFeatureService featureService;
    private final SsqRecommendationMapper recommendationMapper;
    private final ObjectMapper objectMapper;

    /**
     * 为当前用户生成 7 红 + 1 蓝双色球推荐并保存。
     * 同一基准期只保留一条推荐：手动与自动推荐结果一致时不重复生成。
     *
     * @param userId          用户 ID
     * @param baseIssueCount  使用历史期数，空则用默认值
     * @return 推荐结果
     */
    @Transactional
    public SsqRecommendationVO recommend(Long userId, Integer baseIssueCount) {
        int window = baseIssueCount == null ? DEFAULT_BASE_ISSUE_COUNT : baseIssueCount;
        SsqFeatureService.SsqPicks picks = featureService.generatePicks(window);
        SsqFeatureService.SsqFeatureReport report = picks.report();

        SsqRecommendation existing = findExisting(userId, report.latestIssueNo());
        if (existing != null) {
            log.info("双色球推荐已存在，复用: userId={}, 基准期 {}", userId, report.latestIssueNo());
            return toVo(existing);
        }

        SsqRecommendation recommendation = new SsqRecommendation();
        recommendation.setUserId(userId);
        recommendation.setSource("RULE_BASED");
        recommendation.setRedNumbers(picks.redPicks().stream().map(String::valueOf).collect(Collectors.joining(",")));
        recommendation.setBlueNumber(String.valueOf(picks.bluePick()));
        recommendation.setBaseIssueCount(window);
        recommendation.setLatestIssueNo(report.latestIssueNo());
        // 双色球每周二四日开奖：预测开奖日 = 最新已开奖日之后最近的开奖日
        recommendation.setPredictedDrawDate(nextDrawDate(report.latestDrawDate()));
        recommendation.setFeatureSummary(report.deepSummary());
        recommendation.setAnalysisJson(buildAnalysisJson(report));
        recommendation.setDisclaimer(DISCLAIMER);
        recommendationMapper.insert(recommendation);
        log.info("双色球推荐生成: userId={}, 红球={}, 蓝球={}, 基准期 {}",
                userId, picks.redPicks(), picks.bluePick(), report.latestIssueNo());
        return toVo(recommendation);
    }

    /**
     * 查询用户基于指定基准期的已有推荐。
     */
    private SsqRecommendation findExisting(Long userId, String latestIssueNo) {
        return recommendationMapper.selectOne(Wrappers.<SsqRecommendation>lambdaQuery()
                .eq(SsqRecommendation::getUserId, userId)
                .eq(SsqRecommendation::getLatestIssueNo, latestIssueNo)
                .last("LIMIT 1"));
    }

    /**
     * 计算最新已开奖日之后最近的开奖日（周二/四/日）。
     *
     * @param latestDrawDate 最新已开奖日期
     * @return 预测开奖日期
     */
    static java.time.LocalDate nextDrawDate(java.time.LocalDate latestDrawDate) {
        java.time.LocalDate date = latestDrawDate.plusDays(1);
        while (date.getDayOfWeek() != java.time.DayOfWeek.TUESDAY
                && date.getDayOfWeek() != java.time.DayOfWeek.THURSDAY
                && date.getDayOfWeek() != java.time.DayOfWeek.SUNDAY) {
            date = date.plusDays(1);
        }
        return date;
    }

    /**
     * 分页查询当前用户的双色球推荐历史。
     *
     * @param userId 用户 ID
     * @param page   页码
     * @param size   每页条数
     * @return 推荐历史分页
     */
    @Transactional(readOnly = true)
    public PageResult<SsqRecommendationVO> list(Long userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        Page<SsqRecommendation> result = recommendationMapper.selectPage(new Page<>(safePage + 1L, safeSize),
                Wrappers.<SsqRecommendation>lambdaQuery()
                        .eq(SsqRecommendation::getUserId, userId)
                        .orderByDesc(SsqRecommendation::getCreateTime));
        return PageResult.of(result, result.getRecords().stream().map(this::toVo).toList());
    }

    private String buildAnalysisJson(SsqFeatureService.SsqFeatureReport report) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("strategyVersion", STRATEGY_VERSION);
        root.put("confidenceLabel", "中低");
        ObjectNode backtest = root.putObject("backtestSummary");
        backtest.put("evaluatedIssueCount", report.backtest().evaluatedIssueCount());
        backtest.put("averageRedHit", report.backtest().averageRedHit());
        backtest.put("blueHitRate", report.backtest().blueHitRate());
        backtest.put("summary", report.backtest().summary());
        ArrayNode distribution = backtest.putArray("redHitDistribution");
        for (int hit = 0; hit <= 7; hit += 1) {
            distribution.add(report.backtest().redHitDistribution().getOrDefault(hit, 0));
        }
        ObjectNode analysis = root.putObject("analysis");
        analysis.put("overview", report.deepSummary());
        ArrayNode signals = analysis.putArray("featureSignals");
        report.redProfiles().stream()
                .filter(profile -> profile.score() > 50)
                .limit(5)
                .forEach(profile -> signals.add(profile.number() + " 号综合分 " + String.format("%.1f", profile.score())
                        + "（频次 " + profile.frequency() + "，遗漏 " + profile.omission() + " 期）"));
        ArrayNode warnings = analysis.putArray("riskWarnings");
        warnings.add("彩票开奖结果独立随机，历史统计不能保证命中。");
        warnings.add("双色球 7 红复式每注 2 元，共 7 注 14 元，请理性购彩。");
        return root.toString();
    }

    private SsqRecommendationVO toVo(SsqRecommendation entity) {
        return new SsqRecommendationVO(
                entity.getId(),
                entity.getSource(),
                parseNumbers(entity.getRedNumbers()),
                parseBlue(entity.getBlueNumber()),
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

    private Integer parseBlue(String value) {
        try {
            return value == null ? null : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
