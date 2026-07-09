package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 快乐8推荐请求，支持选1到选10玩法。
 *
 * @param baseIssueCount 使用的历史期数
 * @param pickSize       每组推荐号码数量（1-10），为空时默认 5
 */
public record LotteryKl8RecommendationRequest(
        @Min(value = 20, message = "至少需要使用 20 期历史数据")
        @Max(value = 2000, message = "最多使用 2000 期历史数据")
        Integer baseIssueCount,
        @Min(value = 1, message = "每组至少 1 个号码")
        @Max(value = 10, message = "每组最多 10 个号码")
        Integer pickSize
) {
}
