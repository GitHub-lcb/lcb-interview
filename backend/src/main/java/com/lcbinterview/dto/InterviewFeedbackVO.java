package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 面试训练评分结果，返回总分、分项评分、改进建议和追问。
 *
 * @param score     总分
 * @param level     评分等级
 * @param criteria  分项评分
 * @param advice    改进建议
 * @param followUps 追问列表
 * @param source    评分来源
 */
@Schema(description = "面试训练评分结果")
public record InterviewFeedbackVO(
        @Schema(description = "总分")
        int score,

        @Schema(description = "评分等级")
        String level,

        @Schema(description = "分项评分")
        List<InterviewCriterionVO> criteria,

        @Schema(description = "改进建议")
        List<String> advice,

        @Schema(description = "追问列表")
        List<String> followUps,

        @Schema(description = "评分来源")
        String source
) {
}
