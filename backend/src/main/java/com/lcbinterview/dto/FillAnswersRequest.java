package com.lcbinterview.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * AI 补答案请求参数。
 *
 * @param categoryId 分类 ID，null 表示所有分类
 * @param count      补答案数量，默认 10
 */
public record FillAnswersRequest(
    Long categoryId,
    @Min(1) @Max(100) int count
) {
    public FillAnswersRequest {
        if (count <= 0) { count = 10; }
    }
}
