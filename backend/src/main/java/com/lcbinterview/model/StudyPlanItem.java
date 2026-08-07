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
 * 突击计划明细实体，每日背题清单项。
 */
@Data
@TableName("study_plan_item")
public class StudyPlanItem {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 计划 ID */
    @TableField("plan_id")
    private Long planId;

    /** 考点 ID，可空 */
    @TableField("knowledge_point_id")
    private Long knowledgePointId;

    /** 题目 ID */
    @TableField("question_id")
    private Long questionId;

    /** 计划背诵日期 */
    @TableField("scheduled_date")
    private LocalDate scheduledDate;

    /** TODO/DONE/REVIEW */
    private String status;

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
