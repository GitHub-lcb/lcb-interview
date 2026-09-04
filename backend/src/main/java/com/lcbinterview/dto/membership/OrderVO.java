package com.lcbinterview.dto.membership;

import com.lcbinterview.model.UserOrder;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 订单视图对象。
 *
 * @param orderNo      订单号
 * @param type         订单类型：SUBSCRIPTION / CREDIT_PACK
 * @param planCode     关联计划编码
 * @param creditAmount 积分包包含积分数量
 * @param amountCents  订单金额，单位分
 * @param status       订单状态
 * @param createTime   创建时间
 * @param paidTime     支付完成时间
 */
@Schema(description = "订单视图对象")
public record OrderVO(
        @Schema(description = "订单号") String orderNo,
        @Schema(description = "订单类型") String type,
        @Schema(description = "关联计划编码") String planCode,
        @Schema(description = "积分包包含积分数量") Integer creditAmount,
        @Schema(description = "订单金额，单位分") Integer amountCents,
        @Schema(description = "订单状态") String status,
        @Schema(description = "创建时间") LocalDateTime createTime,
        @Schema(description = "支付完成时间") LocalDateTime paidTime
) {

    /**
     * 从订单实体创建视图对象。
     *
     * @param order 订单实体
     * @return 视图对象
     */
    public static OrderVO from(UserOrder order) {
        return new OrderVO(
                order.getOrderNo(), order.getType(), order.getPlanCode(), order.getCreditAmount(),
                order.getAmountCents(), order.getStatus(), order.getCreateTime(), order.getPaidTime());
    }
}
