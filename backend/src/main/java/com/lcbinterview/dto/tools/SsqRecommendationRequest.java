package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 双色球推荐请求。
 *
 * @param baseIssueCount 使用的历史期数，可选
 */
public record SsqRecommendationRequest(
        @Min(value = 30, message = "至少需要使用 30 期历史数据")
        @Max(value = 500, message = "最多使用 500 期历史数据")
        Integer baseIssueCount
) {
}
