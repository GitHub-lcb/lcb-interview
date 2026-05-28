package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "题目查询参数")
public record QuestionQuery(
        @Schema(description = "分类 ID") Long category,
        @Schema(description = "难度：EASY / MEDIUM / HARD") String difficulty,
        @Schema(description = "搜索关键词") String keyword,
        @Schema(description = "标签 ID") Long tag,
        @Builder.Default @Schema(description = "页码（从 0 开始）") Integer page,
        @Builder.Default @Schema(description = "每页条数") Integer size
) {
    public QuestionQuery {
        if (page == null) page = 0;
        if (size == null) size = 20;
    }
}
