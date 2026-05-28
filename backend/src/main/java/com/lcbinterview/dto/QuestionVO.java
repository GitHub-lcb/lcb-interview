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
        @Schema(description = "题目内容，Markdown 格式") String content,
        @Schema(description = "答案，Markdown 格式") String answer,
        @Schema(description = "难度") String difficulty,
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "分类名称") String categoryName,
        @Schema(description = "标签列表") List<String> tags,
        @Schema(description = "浏览次数") Integer viewCount,
        @Schema(description = "创建时间") LocalDateTime createTime
) {
    /**
     * 从 Question 实体创建 VO，需要外部传入分类名称和标签列表。
     */
    public static QuestionVO from(Question question, String categoryName, List<String> tags) {
        return new QuestionVO(
                question.getId(), question.getTitle(),
                question.getContent(), question.getAnswer(),
                question.getDifficulty(), question.getCategoryId(),
                categoryName, tags,
                question.getViewCount(), question.getCreateTime()
        );
    }
}
