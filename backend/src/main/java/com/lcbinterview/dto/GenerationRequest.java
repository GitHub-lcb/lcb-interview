package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * AI 生成题目请求参数。
 * @author chongan
 */
@Schema(description = "AI 生成请求")
public record GenerationRequest(
        @NotBlank @Schema(description = "分类名称") String category,
        @Schema(description = "难度: EASY/MEDIUM/HARD，可选") String difficulty,
        @Min(1) @Max(20) @Schema(description = "生成数量") int count,
        @Schema(description = "主题关键词，可选") String topic
) {}
