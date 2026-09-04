package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 面试评分响应，在评分结果基础上附带今日剩余 AI 评分次数，供前端展示配额提示。
 *
 * @param feedback      评分结果
 * @param remainingToday 今日剩余 AI 评分次数，-1 表示不限量
 */
@Schema(description = "面试评分响应")
public record InterviewEvaluateResultVO(
        @Schema(description = "评分结果") InterviewFeedbackVO feedback,
        @Schema(description = "今日剩余 AI 评分次数，-1 表示不限量") int remainingToday
) {
}
