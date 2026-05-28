package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 题库分类。如 Java 基础、MySQL、Redis 等。
 */
@Data
@TableName("category")
public class Category {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 分类名称，如 Java 基础、MySQL */
    private String name;

    /** 图标 URL */
    private String icon;

    /** 分类描述 */
    private String description;

    /** 排序权重，越小越靠前 */
    @TableField("sort_order")
    private Integer sortOrder;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记（0-正常，1-删除） */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
