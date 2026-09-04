package com.lcbinterview.dto.membership;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 当前用户会员状态，包含档位、到期时间、积分余额和今日各资源配额用量。
 *
 * @param level           会员等级：FREE / PRO
 * @param expireTime      会员到期时间，FREE 用户为空
 * @param planCode        当前订阅计划编码，FREE 用户为空
 * @param creditBalance   AI 积分余额
 * @param quotaEnabled    配额墙是否开启
 * @param quotas          今日各资源配额用量
 */
@Schema(description = "用户会员状态")
public record MembershipStatusVO(
        @Schema(description = "会员等级") String level,
        @Schema(description = "会员到期时间") LocalDateTime expireTime,
        @Schema(description = "当前订阅计划编码") String planCode,
        @Schema(description = "AI 积分余额") int creditBalance,
        @Schema(description = "配额墙是否开启") boolean quotaEnabled,
        @Schema(description = "今日各资源配额用量") List<QuotaUsageVO> quotas
) {
}
