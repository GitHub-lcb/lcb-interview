package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 大乐透同步状态。
 */
@Schema(description = "大乐透同步状态")
public record DltSyncStatusVO(
        String latestIssueNo,
        LocalDate latestDrawDate,
        long drawCount,
        LocalDateTime lastSyncAt,
        boolean stale,
        String message
) {
}
