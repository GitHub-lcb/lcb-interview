package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 快乐8选5推荐请求。
 *
 * @param baseIssueCount 使用的历史期数
 */
public record LotteryKl8RecommendationRequest(
        @Min(value = 20, message = "至少需要使用 20 期历史数据")
        @Max(value = 500, message = "最多使用 500 期历史数据")
        Integer baseIssueCount
) {
}
