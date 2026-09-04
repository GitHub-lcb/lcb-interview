package com.lcbinterview.dto.membership;

import com.lcbinterview.model.UserCredit;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * AI 积分余额视图对象。
 *
 * @param balance       当前余额
 * @param totalGranted  累计获得
 * @param totalConsumed 累计消耗
 */
@Schema(description = "AI 积分余额")
public record CreditBalanceVO(
        @Schema(description = "当前余额") int balance,
        @Schema(description = "累计获得") long totalGranted,
        @Schema(description = "累计消耗") long totalConsumed
) {

    /**
     * 从积分账户实体创建视图对象。
     *
     * @param credit 积分账户
     * @return 视图对象
     */
    public static CreditBalanceVO from(UserCredit credit) {
        return new CreditBalanceVO(credit.getBalance(), credit.getTotalGranted(), credit.getTotalConsumed());
    }
}
