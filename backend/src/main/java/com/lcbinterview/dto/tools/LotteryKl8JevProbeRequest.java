package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Jev 号码概率推算请求。
 *
 * @param baseIssueCount 构建特征报告使用的历史期数（20-2000），空值使用默认值
 * @param pickSize       每组号码数量（1-10），空值使用站点默认选4
 */
public record LotteryKl8JevProbeRequest(
        @Min(value = 20, message = "至少需要使用 20 期历史数据")
        @Max(value = 2000, message = "最多使用 2000 期历史数据")
        Integer baseIssueCount,
        @Min(value = 1, message = "每组号码至少 1 个")
        @Max(value = 10, message = "每组号码最多 10 个")
        Integer pickSize
) {
}
