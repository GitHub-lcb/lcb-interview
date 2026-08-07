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
 * 高频考点实体，位于分类与题目之间，作为突击计划与权重计算的知识层。
 */
@Data
@TableName("knowledge_point")
public class KnowledgePoint {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属分类 ID */
    @TableField("category_id")
    private Long categoryId;

    /** 考点名称，如 HashMap原理 */
    private String name;

    /** 唯一英文标识 */
    private String slug;

    /** 依赖的父考点 ID，可空 */
    @TableField("parent_id")
    private Long parentId;

    /** 高频权重分 0-100 */
    @TableField("hot_score")
    private Integer hotScore;

    /** 权重来源：CORPUS/FEEDBACK/BLEND */
    @TableField("hot_score_source")
    private String hotScoreSource;

    /** DRAFT 待审核/ACTIVE 生效 */
    private String status;

    /** 考点说明 */
    private String description;

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
