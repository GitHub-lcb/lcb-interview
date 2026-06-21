package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 题目查询参数。使用 Builder 模式构建，支持可选参数。
 * @author chongan
 */
@Builder
@Schema(description = "题目查询参数")
public record QuestionQuery(
        @Schema(description = "分类 ID") Long category,
        @Schema(description = "难度：EASY / MEDIUM / HARD") String difficulty,
        @Schema(description = "搜索关键词") String keyword,
        @Schema(description = "标签 ID") Long tag,
        @Schema(description = "排序方式：latest / hot / relevance") String sort,
        @Schema(description = "页码（从 0 开始）") Integer page,
        @Schema(description = "每页条数") Integer size
) {
    public QuestionQuery {
        difficulty = normalizeText(difficulty);
        keyword = normalizeText(keyword);
        sort = normalizeText(sort);
        if (page == null) {
            page = 0;
        }
        if (size == null) {
            size = 20;
        }
    }

    private static String normalizeText(String text) {
        if (text == null) {
            return null;
        }
        String normalized = text.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized;
    }
}
