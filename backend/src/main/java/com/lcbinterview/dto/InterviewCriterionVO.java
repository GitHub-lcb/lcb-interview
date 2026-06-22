package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 面试评分单项维度。
 *
 * @param key     维度标识
 * @param label   维度名称
 * @param score   维度得分
 * @param summary 维度反馈
 */
@Schema(description = "面试评分单项维度")
public record InterviewCriterionVO(
        @Schema(description = "维度标识")
        String key,

        @Schema(description = "维度名称")
        String label,

        @Schema(description = "维度得分")
        int score,

        @Schema(description = "维度反馈")
        String summary
) {
}
