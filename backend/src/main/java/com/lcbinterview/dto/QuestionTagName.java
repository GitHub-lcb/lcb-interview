package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 题目标签名查询结果，用于批量组装题目 VO 的标签列表。
 *
 * @param questionId 题目 ID
 * @param tagName    标签名称
 */
@Schema(description = "题目标签名查询结果")
public record QuestionTagName(
        @Schema(description = "题目 ID") Long questionId,
        @Schema(description = "标签名称") String tagName
) {
}
