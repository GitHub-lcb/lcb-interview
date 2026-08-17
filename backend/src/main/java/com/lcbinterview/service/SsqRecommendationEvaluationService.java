package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.mapper.SsqRecommendationMapper;
import com.lcbinterview.model.SsqDraw;
import com.lcbinterview.model.SsqRecommendation;
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
 * 双色球推荐命中结算服务：基于下一期开奖回填历史推荐表现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SsqRecommendationEvaluationService {

    private static final int MAX_PENDING_EVALUATION = 200;

    private final SsqRecommendationMapper recommendationMapper;
    private final SsqDrawMapper drawMapper;
    private final ObjectMapper objectMapper;

    /**
     * 批量结算尚未回填命中结果的双色球推荐。
     *
     * @return 本次结算记录数
     */
    @Transactional
    public int evaluatePendingRecommendations() {
        List<SsqRecommendation> pending = recommendationMapper.selectList(
                Wrappers.<SsqRecommendation>lambdaQuery()
                        .and(wrapper -> wrapper
                                .isNull(SsqRecommendation::getEvaluatedIssueNo)
                                .or()
                                .eq(SsqRecommendation::getEvaluatedIssueNo, ""))
                        .isNotNull(SsqRecommendation::getLatestIssueNo)
                        .orderByAsc(SsqRecommendation::getCreateTime)
                        .last("LIMIT " + MAX_PENDING_EVALUATION));
        int evaluated = 0;
        for (SsqRecommendation recommendation : pending) {
            SsqDraw nextDraw = nextDraw(recommendation.getLatestIssueNo());
            if (nextDraw == null) {
                continue;
            }
            try {
                evaluateRecommendation(recommendation, nextDraw);
                evaluated += 1;
            } catch (Exception e) {
                log.warn("双色球推荐命中结算失败: recommendationId={}, error={}",
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
    public void evaluateRecommendation(SsqRecommendation recommendation, SsqDraw draw) {
        Set<Integer> drawReds = new LinkedHashSet<>(parseNumbers(draw.getRedNumbers()));
        int drawBlue = parseBlue(draw.getBlueNumber());
        List<Integer> redPicks = parseNumbers(recommendation.getRedNumbers());
        int bluePick = parseBlue(recommendation.getBlueNumber());

        List<Integer> hitReds = redPicks.stream()
                .filter(drawReds::contains)
                .sorted()
                .toList();
        boolean blueHit = bluePick == drawBlue;
        int redHitCount = hitReds.size();
        int totalHit = redHitCount + (blueHit ? 1 : 0);

        ObjectNode summary = objectMapper.createObjectNode();
        summary.put("issueNo", draw.getIssueNo());
        summary.put("drawDate", draw.getDrawDate().toString());
        summary.put("redHitCount", redHitCount);
        summary.put("blueHit", blueHit);
        summary.put("totalHitCount", totalHit);
        ArrayNode reds = summary.putArray("hitReds");
        hitReds.forEach(reds::add);

        recommendation.setEvaluatedIssueNo(draw.getIssueNo());
        recommendation.setEvaluatedDrawDate(draw.getDrawDate());
        recommendation.setHitSummaryJson(summary.toString());
        recommendation.setTotalHitCount(totalHit);
        recommendation.setMaxHitCount(redHitCount);
        recommendation.setEvaluatedAt(LocalDateTime.now());
        recommendationMapper.updateById(recommendation);
        log.info("双色球推荐结算: id={}, 红球命中 {} 个, 蓝球{}, 总命中 {}",
                recommendation.getId(), redHitCount, blueHit ? "中" : "未中", totalHit);
    }

    private SsqDraw nextDraw(String latestIssueNo) {
        if (latestIssueNo == null || latestIssueNo.isBlank()) {
            return null;
        }
        return drawMapper.selectOne(Wrappers.<SsqDraw>lambdaQuery()
                .gt(SsqDraw::getIssueNo, latestIssueNo)
                .orderByAsc(SsqDraw::getIssueNo)
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

    private int parseBlue(String value) {
        try {
            return value == null ? 0 : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
