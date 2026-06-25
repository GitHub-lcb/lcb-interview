package com.lcbinterview.dto;

import com.lcbinterview.model.Question;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 题目视图对象，对外展示不暴露 Entity 内部结构。
 * 由 Service 层组装 categoryName 和 tags。
 * @author chongan
 */
@Schema(description = "题目视图对象")
public record QuestionVO(
        @Schema(description = "题目 ID") Long id,
        @Schema(description = "标题") String title,
        @Schema(description = "摘要") String summary,
        @Schema(description = "题目内容，Markdown 格式") String content,
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
        @Schema(description = "分类名称") String categoryName,
        @Schema(description = "标签列表") List<String> tags,
        @Schema(description = "浏览次数") Integer viewCount,
        @Schema(description = "创建时间") LocalDateTime createTime,
        @Schema(description = "同分类上一题 ID") Long previousId,
        @Schema(description = "同分类下一题 ID") Long nextId
) {
    /**
     * 从 Question 实体创建 VO，需要外部传入分类名称和标签列表。
     */
    public static QuestionVO from(Question question, String categoryName, List<String> tags) {
        return new QuestionVO(
                question.getId(), question.getTitle(),
                question.getSummary(), question.getContent(),
                question.getPrinciple(), question.getComparison(),
                question.getScenario(), question.getRisk(),
                question.getProjectExp(), question.getCodeExamples(),
                question.getDiagrams(), question.getRelatedIds(),
                question.getDifficulty(), question.getCategoryId(),
                categoryName, tags,
                question.getViewCount(), question.getCreateTime(),
                null, null
        );
    }

    /**
     * 返回带同分类上下题导航的副本。
     *
     * @param previousId 同分类上一题 ID，可为空
     * @param nextId 同分类下一题 ID，可为空
     * @return 带导航信息的题目 VO
     */
    public QuestionVO withNavigation(Long previousId, Long nextId) {
        return new QuestionVO(
                id, title, summary, content, principle, comparison, scenario, risk,
                projectExp, codeExamples, diagrams, relatedIds, difficulty, categoryId,
                categoryName, tags, viewCount, createTime, previousId, nextId
        );
    }
}
