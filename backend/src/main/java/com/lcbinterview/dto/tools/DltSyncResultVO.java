package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 大乐透同步结果。
 */
@Schema(description = "大乐透同步结果")
public record DltSyncResultVO(
        boolean success,
        int fetchedCount,
        int insertedCount,
        String latestIssueNo,
        int evaluatedCount,
        String message
) {
}
