package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 高频考点视图对象，公开接口展示考点排行数据，不暴露实体内部结构。
 *
 * @param hotScoreSource 权重来源：CORPUS/FEEDBACK/BLEND
 * @param mentionTotal   语料中提及总次数
 * @param docCount       覆盖语料篇数
 * @param questionCount  关联已发布题目数
 */
@Schema(description = "高频考点视图对象")
public record KnowledgePointVO(
        @Schema(description = "考点 ID") Long id,
        @Schema(description = "考点名称") String name,
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "分类名称") String categoryName,
        @Schema(description = "高频权重分 0-100") Integer hotScore,
        @Schema(description = "权重来源") String hotScoreSource,
        @Schema(description = "语料提及总次数") Long mentionTotal,
        @Schema(description = "覆盖语料篇数") Long docCount,
        @Schema(description = "关联已发布题目数") Long questionCount
) {
}
