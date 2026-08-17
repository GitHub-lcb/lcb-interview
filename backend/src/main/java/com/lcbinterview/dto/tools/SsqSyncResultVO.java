package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 双色球同步结果。
 *
 * @param success       是否成功
 * @param fetchedCount  抓取条数
 * @param insertedCount 新增条数
 * @param latestIssueNo 最新期号
 * @param evaluatedCount 本次结算推荐条数
 * @param message       结果消息
 */
@Schema(description = "双色球同步结果")
public record SsqSyncResultVO(
        boolean success,
        int fetchedCount,
        int insertedCount,
        String latestIssueNo,
        int evaluatedCount,
        String message
) {
}
