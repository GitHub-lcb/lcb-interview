package com.lcbinterview.dto.membership;

import com.lcbinterview.model.MembershipPlan;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 订阅计划与积分包视图对象。
 *
 * @param code               计划编码
 * @param type               计划类型：SUBSCRIPTION / CREDIT_PACK
 * @param name               计划名称
 * @param priceCents         价格，单位分
 * @param durationDays       订阅时长天数
 * @param creditAmount       积分包包含积分数量
 * @param monthlyCreditGrant 订阅开通赠送积分数量
 */
@Schema(description = "订阅计划与积分包")
public record MembershipPlanVO(
        @Schema(description = "计划编码") String code,
        @Schema(description = "计划类型") String type,
        @Schema(description = "计划名称") String name,
        @Schema(description = "价格，单位分") Integer priceCents,
        @Schema(description = "订阅时长天数") Integer durationDays,
        @Schema(description = "积分包包含积分数量") Integer creditAmount,
        @Schema(description = "订阅开通赠送积分数量") Integer monthlyCreditGrant
) {

    /**
     * 从计划实体创建视图对象。
     *
     * @param plan 计划实体
     * @return 视图对象
     */
    public static MembershipPlanVO from(MembershipPlan plan) {
        return new MembershipPlanVO(
                plan.getCode(), plan.getType(), plan.getName(), plan.getPriceCents(),
                plan.getDurationDays(), plan.getCreditAmount(), plan.getMonthlyCreditGrant());
    }
}
