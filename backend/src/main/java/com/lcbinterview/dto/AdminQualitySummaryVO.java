package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 管理后台质量总览，汇总全站题目状态、内容缺口和分类风险排行。
 */
@Schema(description = "管理后台质量总览")
public record AdminQualitySummaryVO(
        @Schema(description = "题目总数") long totalQuestions,
        @Schema(description = "已发布题目数") long publishedQuestions,
        @Schema(description = "草稿题目数") long draftQuestions,
        @Schema(description = "已驳回题目数") long rejectedQuestions,
        @Schema(description = "空答案题目数") long emptyAnswerQuestions,
        @Schema(description = "质量风险题目数") long qualityRiskQuestions,
        @Schema(description = "整体完成率，0-100") int completionRate,
        @Schema(description = "分类质量排行") List<AdminCategoryQualityVO> categories,
        @Schema(description = "运营待办") List<AdminQualityTodoVO> todos
) {
}
