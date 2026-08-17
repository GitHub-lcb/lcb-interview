package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 双色球推荐视图。
 *
 * @param id                推荐 ID
 * @param source            推荐来源
 * @param redNumbers        7 个红球
 * @param blueNumber        1 个蓝球
 * @param baseIssueCount    使用历史期数
 * @param latestIssueNo     生成时最新期号
 * @param featureSummary    特征摘要
 * @param analysisJson      分析 JSON（回测摘要）
 * @param evaluatedIssueNo  结算期号，未结算为空
 * @param evaluatedDrawDate 结算开奖日期
 * @param totalHitCount     红球命中 + 蓝球命中
 * @param maxHitCount       红球命中数
 * @param hitSummaryJson    命中明细
 * @param disclaimer        风险提示
 * @param createdAt         创建时间
 */
@Schema(description = "双色球推荐")
public record SsqRecommendationVO(
        Long id,
        String source,
        List<Integer> redNumbers,
        Integer blueNumber,
        Integer baseIssueCount,
        String latestIssueNo,
        String featureSummary,
        String analysisJson,
        String evaluatedIssueNo,
        LocalDate evaluatedDrawDate,
        Integer totalHitCount,
        Integer maxHitCount,
        String hitSummaryJson,
        String disclaimer,
        LocalDateTime createdAt
) {
}
