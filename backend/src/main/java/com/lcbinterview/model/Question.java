package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 面试题目。包含多级内容字段（摘要/原理/对比/场景/风险/项目经验）、
 * 代码示例、图解、关联题目标识，以及审核状态和来源信息。
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

    /** 30秒速览，纯文本50-100字 */
    private String summary;

    /** 原理深度解析 (Markdown) */
    private String principle;

    /** 对比分析 (Markdown) */
    private String comparison;

    /** 适用场景 (Markdown) */
    private String scenario;

    /** 风险与常见坑 (Markdown) */
    private String risk;

    /** 项目实战经验 (Markdown) */
    @TableField("project_exp")
    private String projectExp;

    /** 代码示例 JSON: [{lang, title, code, description}] */
    @TableField("code_examples")
    private String codeExamples;

    /** 图解 JSON: [{type, alt, content, caption}] */
    @TableField("diagrams")
    private String diagrams;

    /** 关联题目 ID 列表 JSON: [Long] */
    @TableField("related_ids")
    private String relatedIds;

    /** 状态: DRAFT / PUBLISHED / REJECTED */
    private String status;

    /** 来源: AI_GENERATED / MANUAL */
    private String source;

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
