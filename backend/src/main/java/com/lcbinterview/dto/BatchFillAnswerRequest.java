package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 后台批量补答案请求参数。分类为空时处理所有分类，最大处理数量为空时补到待补草稿清零。
 *
 * @param categoryId 分类 ID，可选
 * @param maxQuestions 本次最大处理题数，可选
 * @param delaySeconds API 调用间隔秒数
 */
@Schema(description = "后台批量补答案请求")
public record BatchFillAnswerRequest(
        @Schema(description = "分类 ID，为空则补所有分类") Long categoryId,
        @Min(1) @Schema(description = "本次最大处理题数，为空则补到清零") Integer maxQuestions,
        @Min(0) @Max(300) @Schema(description = "API 调用间隔秒数", defaultValue = "3") Integer delaySeconds
) {
    public BatchFillAnswerRequest {
        if (delaySeconds == null) {
            delaySeconds = 3;
        }
    }
}
