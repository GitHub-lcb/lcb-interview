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
 * 用户会员订阅记录实体。同一用户同一时间最多一条 ACTIVE 记录，续费在到期时间上叠加。
 */
@Data
@TableName("user_membership")
public class UserMembership {

    /** 订阅状态：生效中 */
    public static final String STATUS_ACTIVE = "ACTIVE";

    /** 订阅状态：已到期 */
    public static final String STATUS_EXPIRED = "EXPIRED";

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 订阅计划编码 */
    @TableField("plan_code")
    private String planCode;

    /** 本期订阅开始时间 */
    @TableField("start_time")
    private LocalDateTime startTime;

    /** 本期订阅到期时间 */
    @TableField("expire_time")
    private LocalDateTime expireTime;

    /** 订阅状态：ACTIVE / EXPIRED / CANCELLED */
    private String status;

    /** 是否自动续费：0 否 / 1 是 */
    @TableField("auto_renew")
    private Integer autoRenew;

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
