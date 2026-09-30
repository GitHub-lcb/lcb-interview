package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 快乐8 概率实验室请求。
 *
 * @param baseIssueCount 权重寻优使用的历史期数（20-2000）
 * @param windowSize     投注组合实验回放的期数（10-300）
 * @param maxTicketCount 投注组合实验的最大注数（1-20，20 为互不重复时覆盖全部号码的上限）
 */
public record LotteryKl8LabRequest(
        @Min(value = 20, message = "至少需要使用 20 期历史数据")
        @Max(value = 2000, message = "最多使用 2000 期历史数据")
        Integer baseIssueCount,
        @Min(value = 10, message = "回放期数至少 10 期")
        @Max(value = 300, message = "回放期数最多 300 期")
        Integer windowSize,
        @Min(value = 1, message = "注数至少 1 注")
        @Max(value = 20, message = "注数最多 20 注（覆盖全部 80 个号码的上限）")
        Integer maxTicketCount
) {
}
