package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 大乐透推荐视图。
 */
@Schema(description = "大乐透推荐")
public record DltRecommendationVO(
        Long id,
        String source,
        List<Integer> frontNumbers,
        List<Integer> backNumbers,
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
