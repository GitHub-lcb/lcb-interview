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
 * 学习进度云同步快照实体。每个普通用户仅保留一份最新进度 JSON 快照，
 * 前端 localStorage 的进度对象整体落库，服务端不解析内部结构。
 */
@Data
@TableName("study_progress_snapshot")
public class StudyProgressSnapshot {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 用户 ID，唯一约束，一人一份快照 */
    @TableField("user_id")
    private Long userId;

    /** 学习进度 JSON 快照（前端进度对象整体序列化） */
    @TableField("progress_json")
    private String progressJson;

    /** 客户端进度更新时间 ISO 字符串，用于多端同步冲突判断 */
    @TableField("client_updated_at")
    private String clientUpdatedAt;

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
