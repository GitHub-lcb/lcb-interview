package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 用户面试回填实体，面试后回填被问到的题目/考点，驱动权重进化。
 */
@Data
@TableName("interview_feedback")
public class InterviewFeedback {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 回填用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 面试公司 */
    private String company;

    /** 面试岗位 */
    private String position;

    /** 被问到的题目 ID，可空 */
    @TableField("question_id")
    private Long questionId;

    /** 命中考点 ID */
    @TableField("knowledge_point_id")
    private Long knowledgePointId;

    /** 面试日期 */
    @TableField("interview_date")
    private LocalDate interviewDate;

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
