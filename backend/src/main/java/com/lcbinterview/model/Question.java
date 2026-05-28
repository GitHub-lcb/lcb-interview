package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 面试题目。包含题目标题、内容（Markdown）、答案（Markdown）等核心信息。
 * @author chongan
 */
@Data
@TableName("question")
public class Question {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 关联分类 ID */
    @TableField("category_id")
    private Long categoryId;

    /** 题目标题 */
    private String title;

    /** 题目内容，Markdown 格式 */
    private String content;

    /** 题目答案，Markdown 格式 */
    private String answer;

    /** 难度：EASY / MEDIUM / HARD */
    private String difficulty;

    /** 浏览次数 */
    @TableField("view_count")
    private Integer viewCount = 0;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记 */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
