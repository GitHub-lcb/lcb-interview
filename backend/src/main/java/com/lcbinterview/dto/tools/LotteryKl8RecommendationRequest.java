package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 快乐8推荐请求，固定选5玩法。
 *
 * @param baseIssueCount 使用的历史期数
 */
public record LotteryKl8RecommendationRequest(
        @Min(value = 20, message = "至少需要使用 20 期历史数据")
        @Max(value = 2000, message = "最多使用 2000 期历史数据")
        Integer baseIssueCount
) {
}
