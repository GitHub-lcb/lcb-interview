package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8候选池号码，供规则兜底和 AI 选择时复用。
 *
 * @param number   号码，范围 1-80
 * @param score    综合候选分
 * @param roles    候选角色标签
 * @param evidence 入选依据
 */
public record LotteryKl8CandidateNumber(
        int number,
        double score,
        List<String> roles,
        String evidence
) {
}
