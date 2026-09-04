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
 * 会员订阅计划与积分包实体，同时承载订阅套餐和积分包两种售卖商品。
 */
@Data
@TableName("membership_plan")
public class MembershipPlan {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 计划编码，如 PRO_MONTHLY / CREDIT_PACK_100 */
    private String code;

    /** 计划类型：SUBSCRIPTION 订阅 / CREDIT_PACK 积分包 */
    private String type;

    /** 计划名称 */
    private String name;

    /** 价格，单位分 */
    @TableField("price_cents")
    private Integer priceCents;

    /** 订阅时长天数，积分包为 0 */
    @TableField("duration_days")
    private Integer durationDays;

    /** 积分包包含的积分数量 */
    @TableField("credit_amount")
    private Integer creditAmount;

    /** 订阅开通时赠送的积分数量 */
    @TableField("monthly_credit_grant")
    private Integer monthlyCreditGrant;

    /** 计划状态：ACTIVE / OFFLINE */
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
