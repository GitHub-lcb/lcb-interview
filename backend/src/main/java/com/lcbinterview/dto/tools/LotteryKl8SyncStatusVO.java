package com.lcbinterview.dto.tools;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 快乐8开奖同步状态。
 *
 * @param latestIssueNo   最新期号
 * @param latestDrawDate  最新开奖日期
 * @param drawCount       已保存期数
 * @param lastSyncAt      最近同步时间
 * @param stale           是否需要同步
 * @param message         状态说明
 */
public record LotteryKl8SyncStatusVO(
        String latestIssueNo,
        LocalDate latestDrawDate,
        long drawCount,
        LocalDateTime lastSyncAt,
        boolean stale,
        String message
) {
}
