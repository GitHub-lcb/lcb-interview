package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.DltRecommendationMapper;
import com.lcbinterview.model.DltDraw;
import com.lcbinterview.model.DltRecommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 大乐透推荐命中结算服务：基于下一期开奖回填历史推荐表现。
 * 前区命中数 + 后区命中数（推荐后区 3 个，开奖后区 2 个，按交集计数）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DltRecommendationEvaluationService {

    private static final int MAX_PENDING_EVALUATION = 200;

    private final DltRecommendationMapper recommendationMapper;
    private final DltDrawMapper drawMapper;
    private final ObjectMapper objectMapper;

    /**
     * 批量结算尚未回填命中结果的大乐透推荐。
     *
     * @return 本次结算记录数
     */
    @Transactional
    public int evaluatePendingRecommendations() {
        List<DltRecommendation> pending = recommendationMapper.selectList(
                Wrappers.<DltRecommendation>lambdaQuery()
                        .and(wrapper -> wrapper
                                .isNull(DltRecommendation::getEvaluatedIssueNo)
                                .or()
                                .eq(DltRecommendation::getEvaluatedIssueNo, ""))
                        .isNotNull(DltRecommendation::getLatestIssueNo)
                        .orderByAsc(DltRecommendation::getCreateTime)
                        .last("LIMIT " + MAX_PENDING_EVALUATION));
        int evaluated = 0;
        for (DltRecommendation recommendation : pending) {
            DltDraw nextDraw = nextDraw(recommendation.getLatestIssueNo());
            if (nextDraw == null) {
                continue;
            }
            try {
                evaluateRecommendation(recommendation, nextDraw);
                evaluated += 1;
            } catch (Exception e) {
                log.warn("大乐透推荐命中结算失败: recommendationId={}, error={}",
                        recommendation.getId(), e.getMessage());
            }
        }
        return evaluated;
    }

    /**
     * 使用指定期开奖结算单条推荐。
     *
     * @param recommendation 推荐记录
     * @param draw           开奖记录
     */
    public void evaluateRecommendation(DltRecommendation recommendation, DltDraw draw) {
        Set<Integer> drawFronts = new LinkedHashSet<>(parseNumbers(draw.getFrontNumbers()));
        Set<Integer> drawBacks = new LinkedHashSet<>(parseNumbers(draw.getBackNumbers()));
        List<Integer> frontPicks = parseNumbers(recommendation.getFrontNumbers());
        List<Integer> backPicks = parseNumbers(recommendation.getBackNumbers());

        List<Integer> hitFronts = frontPicks.stream()
                .filter(drawFronts::contains)
                .sorted()
                .toList();
        List<Integer> hitBacks = backPicks.stream()
                .filter(drawBacks::contains)
                .sorted()
                .toList();
        int frontHit = hitFronts.size();
        int backHit = hitBacks.size();
        int totalHit = frontHit + backHit;

        ObjectNode summary = objectMapper.createObjectNode();
        summary.put("issueNo", draw.getIssueNo());
        summary.put("drawDate", draw.getDrawDate().toString());
        summary.put("frontHitCount", frontHit);
        summary.put("backHitCount", backHit);
        summary.put("totalHitCount", totalHit);
        ArrayNode hitFrontsNode = summary.putArray("hitFronts");
        hitFronts.forEach(hitFrontsNode::add);
        ArrayNode hitBacksNode = summary.putArray("hitBacks");
        hitBacks.forEach(hitBacksNode::add);

        recommendation.setEvaluatedIssueNo(draw.getIssueNo());
        recommendation.setEvaluatedDrawDate(draw.getDrawDate());
        recommendation.setHitSummaryJson(summary.toString());
        recommendation.setTotalHitCount(totalHit);
        recommendation.setMaxHitCount(frontHit);
        recommendation.setEvaluatedAt(LocalDateTime.now());
        recommendationMapper.updateById(recommendation);
        log.info("大乐透推荐结算: id={}, 前区命中 {} 个, 后区命中 {} 个, 总命中 {}",
                recommendation.getId(), frontHit, backHit, totalHit);
    }

    private DltDraw nextDraw(String latestIssueNo) {
        if (latestIssueNo == null || latestIssueNo.isBlank()) {
            return null;
        }
        return drawMapper.selectOne(Wrappers.<DltDraw>lambdaQuery()
                .gt(DltDraw::getIssueNo, latestIssueNo)
                .orderByAsc(DltDraw::getIssueNo)
                .last("LIMIT 1"));
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
