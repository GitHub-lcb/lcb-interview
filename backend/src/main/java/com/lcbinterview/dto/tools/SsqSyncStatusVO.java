package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 双色球同步状态。
 *
 * @param latestIssueNo 最新期号
 * @param latestDrawDate 最新开奖日期
 * @param drawCount      历史期数
 * @param lastSyncAt     上次同步时间
 * @param stale          数据是否过期
 * @param message        状态消息
 */
@Schema(description = "双色球同步状态")
public record SsqSyncStatusVO(
        String latestIssueNo,
        LocalDate latestDrawDate,
        long drawCount,
        LocalDateTime lastSyncAt,
        boolean stale,
        String message
) {
}
