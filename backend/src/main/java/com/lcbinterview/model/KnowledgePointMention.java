package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 考点提及统计实体，记录每篇面经中某考点被问到的次数与上下文。
 */
@Data
@TableName("knowledge_point_mention")
public class KnowledgePointMention {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 语料 ID */
    @TableField("interview_source_id")
    private Long interviewSourceId;

    /** 考点 ID */
    @TableField("knowledge_point_id")
    private Long knowledgePointId;

    /** 该篇中被问次数 */
    @TableField("mention_count")
    private Integer mentionCount;

    /** 提及上下文片段，用于权重解释 */
    private String context;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 逻辑删除标记 */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
