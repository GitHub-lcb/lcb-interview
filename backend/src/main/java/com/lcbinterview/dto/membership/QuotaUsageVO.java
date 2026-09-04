package com.lcbinterview.dto.membership;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 单个资源的当日配额使用情况。
 *
 * @param resource   资源类型
 * @param dailyLimit 每日免费次数
 * @param used       当日已用次数
 * @param unlimited  是否不限量
 */
@Schema(description = "资源当日配额使用情况")
public record QuotaUsageVO(
        @Schema(description = "资源类型") String resource,
        @Schema(description = "每日免费次数") int dailyLimit,
        @Schema(description = "当日已用次数") int used,
        @Schema(description = "是否不限量") boolean unlimited
) {
}
