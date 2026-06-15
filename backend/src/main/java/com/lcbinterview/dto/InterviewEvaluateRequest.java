package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 面试训练评分请求，包含题目上下文、目标岗位和候选人的口述答案。
 *
 * @param questionTitle 题目标题
 * @param categoryName  分类名称
 * @param tags          题目标签
 * @param difficulty    题目难度
 * @param targetRole    目标岗位
 * @param answer        用户回答
 */
@Schema(description = "面试训练评分请求")
public record InterviewEvaluateRequest(
        @Schema(description = "题目标题")
        @NotBlank(message = "题目标题不能为空")
        String questionTitle,

        @Schema(description = "分类名称")
        String categoryName,

        @Schema(description = "题目标签")
        List<String> tags,

        @Schema(description = "题目难度")
        String difficulty,

        @Schema(description = "目标岗位")
        String targetRole,

        @Schema(description = "用户回答")
        @Size(max = 1600, message = "回答不能超过 1600 字")
        String answer
) {
}
