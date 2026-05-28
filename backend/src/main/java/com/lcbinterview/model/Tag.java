package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 题目标签。对应 question_tag 中间表。
 * @author chongan
 */
@Data
@TableName("tag")
public class Tag {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 标签名，唯一，如 Java、Redis、多线程 */
    private String name;

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
