package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8上一期邻位候选结果，用于解释最终推荐号码来自哪些左右邻号和连号趋势。
 *
 * @param number        候选号码
 * @param anchorNumbers 上一期中触发该候选的原始号码
 * @param directions    相对上一期号码的位置说明
 * @param score         邻位综合分
 * @param selected      是否进入本次最终推荐
 * @param reason        候选理由
 * @param evidence      证据说明
 */
public record LotteryKl8NeighborRecommendation(
        int number,
        List<Integer> anchorNumbers,
        List<String> directions,
        double score,
        boolean selected,
        String reason,
        List<String> evidence
) {
}
