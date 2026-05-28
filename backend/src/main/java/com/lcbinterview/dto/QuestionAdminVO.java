package com.lcbinterview.dto;

import com.lcbinterview.model.Question;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/**
 * 管理端题目视图对象，含审核状态和来源信息。
 * 避免直接将 Entity（含 isDeleted 等内部字段）暴露给前端。
 * @author chongan
 */
@Schema(description = "管理端题目视图对象")
public record QuestionAdminVO(
        @Schema(description = "题目 ID") Long id,
        @Schema(description = "标题") String title,
        @Schema(description = "摘要") String summary,
        @Schema(description = "内容") String content,
        @Schema(description = "答案") String answer,
        @Schema(description = "原理解析") String principle,
        @Schema(description = "对比分析") String comparison,
        @Schema(description = "适用场景") String scenario,
        @Schema(description = "风险与避坑") String risk,
        @Schema(description = "项目实战") String projectExp,
        @Schema(description = "代码示例") String codeExamples,
        @Schema(description = "图解") String diagrams,
        @Schema(description = "关联题目 ID") String relatedIds,
        @Schema(description = "难度") String difficulty,
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "状态") String status,
        @Schema(description = "来源") String source,
        @Schema(description = "创建时间") LocalDateTime createTime
) {
    public static QuestionAdminVO from(Question q) {
        return new QuestionAdminVO(
                q.getId(), q.getTitle(), q.getSummary(), q.getContent(),
                q.getAnswer(),
                q.getPrinciple(), q.getComparison(), q.getScenario(),
                q.getRisk(), q.getProjectExp(), q.getCodeExamples(),
                q.getDiagrams(), q.getRelatedIds(),
                q.getDifficulty(), q.getCategoryId(),
                q.getStatus(), q.getSource(), q.getCreateTime()
        );
    }
}
