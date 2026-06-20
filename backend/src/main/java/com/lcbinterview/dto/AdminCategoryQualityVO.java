package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 管理后台分类质量指标，用于定位哪个题库最需要补答案、复审或重写。
 */
@Schema(description = "管理后台分类质量指标")
public record AdminCategoryQualityVO(
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "分类名称") String categoryName,
        @Schema(description = "题目总数") long total,
        @Schema(description = "已发布题目数") long published,
        @Schema(description = "草稿题目数") long draft,
        @Schema(description = "已驳回题目数") long rejected,
        @Schema(description = "空答案题目数") long emptyAnswer,
        @Schema(description = "短答案题目数") long shortAnswer,
        @Schema(description = "缺少原理解析题目数") long missingPrinciple,
        @Schema(description = "缺少风险边界题目数") long missingRisk,
        @Schema(description = "缺少项目经验题目数") long missingProjectExp,
        @Schema(description = "缺少代码示例题目数") long missingCodeExamples,
        @Schema(description = "质量完成率，0-100") int completionRate,
        @Schema(description = "风险分，越高越需要优先处理") int riskScore
) {
}
