package com.lcbinterview.dto.membership;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 创建订单请求。
 *
 * @param planCode 计划编码，订阅或积分包
 */
@Schema(description = "创建订单请求")
public record OrderCreateRequest(
        @NotBlank(message = "计划编码不能为空")
        @Schema(description = "计划编码，如 PRO_MONTHLY / CREDIT_PACK_100") String planCode
) {
}
