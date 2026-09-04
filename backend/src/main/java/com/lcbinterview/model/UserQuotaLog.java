package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 每日配额消耗流水实体。按（用户、资源、日期）唯一，作为 Redis 计数器不可用时的降级依据和对账凭据。
 */
@Data
@TableName("user_quota_log")
public class UserQuotaLog {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 配额资源类型，如 AI_EVALUATE / EXPORT */
    private String resource;

    /** 配额归属日期，每日 0 点重置 */
    @TableField("quota_date")
    private LocalDate quotaDate;

    /** 当日累计消耗次数 */
    private Integer count;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
