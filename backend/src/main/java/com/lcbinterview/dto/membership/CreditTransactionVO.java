package com.lcbinterview.dto.membership;

import com.lcbinterview.model.CreditTransaction;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 积分流水视图对象。
 *
 * @param id          流水 ID
 * @param type        流水类型
 * @param amount      变动数量，消耗为负
 * @param balanceAfter 变动后余额
 * @param resource    消耗资源类型
 * @param remark      备注说明
 * @param createTime  创建时间
 */
@Schema(description = "积分流水视图对象")
public record CreditTransactionVO(
        @Schema(description = "流水 ID") Long id,
        @Schema(description = "流水类型") String type,
        @Schema(description = "变动数量，消耗为负") Integer amount,
        @Schema(description = "变动后余额") Integer balanceAfter,
        @Schema(description = "消耗资源类型") String resource,
        @Schema(description = "备注说明") String remark,
        @Schema(description = "创建时间") LocalDateTime createTime
) {

    /**
     * 从流水实体创建视图对象。
     *
     * @param transaction 流水实体
     * @return 视图对象
     */
    public static CreditTransactionVO from(CreditTransaction transaction) {
        return new CreditTransactionVO(
                transaction.getId(), transaction.getType(), transaction.getAmount(),
                transaction.getBalanceAfter(), transaction.getResource(),
                transaction.getRemark(), transaction.getCreateTime());
    }
}
