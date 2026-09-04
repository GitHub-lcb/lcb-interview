package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 积分流水实体，记录每次获得、购买、消耗和退款，用于对账和用户账单展示。
 * 流水只增不改，不做逻辑删除。
 */
@Data
@TableName("credit_transaction")
public class CreditTransaction {

    /** 流水类型：赠送（订阅赠送、活动发放） */
    public static final String TYPE_GRANT = "GRANT";

    /** 流水类型：购买积分包 */
    public static final String TYPE_PURCHASE = "PURCHASE";

    /** 流水类型：消耗 */
    public static final String TYPE_CONSUME = "CONSUME";

    /** 流水类型：退款返还 */
    public static final String TYPE_REFUND = "REFUND";

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 流水类型：GRANT / PURCHASE / CONSUME / REFUND */
    private String type;

    /** 变动数量，消耗为负数 */
    private Integer amount;

    /** 变动后余额 */
    @TableField("balance_after")
    private Integer balanceAfter;

    /** 消耗资源类型，仅 CONSUME 流水有值 */
    private String resource;

    /** 关联订单号或业务 ID */
    @TableField("ref_id")
    private String refId;

    /** 备注说明 */
    private String remark;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
