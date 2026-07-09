package com.lcbinterview.dto.tools;

import java.util.List;

/**
 * 快乐8单组推荐，号码数量由 pickSize 决定（1-10）。
 *
 * @param numbers 推荐号码
 * @param reason  推荐理由
 */
public record LotteryKl8RecommendationGroupVO(List<Integer> numbers, String reason) {
}
