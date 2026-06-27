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
 * 读书摘录实体，保存普通用户的书摘、评论和标签。
 */
@Data
@TableName("reading_excerpt")
public class ReadingExcerpt {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 书名 */
    @TableField("book_title")
    private String bookTitle;

    /** 作者 */
    private String author;

    /** 摘录正文 */
    private String content;

    /** 个人评论 */
    private String note;

    /** 标签，逗号分隔 */
    private String tags;

    /** 章节 */
    private String chapter;

    /** 页码 */
    @TableField("page_no")
    private String pageNo;

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
