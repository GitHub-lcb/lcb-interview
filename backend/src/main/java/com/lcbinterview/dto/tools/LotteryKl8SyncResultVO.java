package com.lcbinterview.dto.tools;

/**
 * 快乐8开奖同步结果。
 *
 * @param success       是否成功
 * @param sourceName    来源名称
 * @param fetchedCount  抓取期数
 * @param insertedCount 新增期数
 * @param latestIssueNo 最新期号
 * @param message       结果说明
 */
public record LotteryKl8SyncResultVO(
        boolean success,
        String sourceName,
        int fetchedCount,
        int insertedCount,
        String latestIssueNo,
        String message
) {
}
