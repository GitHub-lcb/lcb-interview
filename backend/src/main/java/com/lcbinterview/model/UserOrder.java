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
 * 会员订阅与积分包订单实体。支付回调按 out_trade_no 幂等处理，重复回调直接返回成功。
 */
@Data
@TableName("user_order")
public class UserOrder {

    /** 订单类型：订阅 */
    public static final String TYPE_SUBSCRIPTION = "SUBSCRIPTION";

    /** 订单类型：积分包 */
    public static final String TYPE_CREDIT_PACK = "CREDIT_PACK";

    /** 订单状态：待支付 */
    public static final String STATUS_PENDING = "PENDING";

    /** 订单状态：已支付 */
    public static final String STATUS_PAID = "PAID";

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 订单号 */
    @TableField("order_no")
    private String orderNo;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 订单类型：SUBSCRIPTION / CREDIT_PACK */
    private String type;

    /** 关联计划编码 */
    @TableField("plan_code")
    private String planCode;

    /** 积分包包含的积分数量 */
    @TableField("credit_amount")
    private Integer creditAmount;

    /** 订单金额，单位分 */
    @TableField("amount_cents")
    private Integer amountCents;

    /** 订单状态：PENDING / PAID / CANCELLED / REFUNDED */
    private String status;

    /** 支付渠道交易号，回调幂等键 */
    @TableField("out_trade_no")
    private String outTradeNo;

    /** 支付完成时间 */
    @TableField("paid_time")
    private LocalDateTime paidTime;

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
