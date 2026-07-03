package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8对子推荐结果，用于解释 5 码组合中的核心对子来源和后续命中结算。
 *
 * @param leftNumber  较小号码
 * @param rightNumber 较大号码
 * @param count       基准期内共现次数
 * @param lift        相对独立出现的提升度
 * @param score       对子综合分
 * @param selected    是否进入本次最终 5 码组合
 * @param reason      选择或备选理由
 * @param evidence    可展示的统计证据
 */
public record LotteryKl8PairRecommendation(
        int leftNumber,
        int rightNumber,
        int count,
        double lift,
        double score,
        boolean selected,
        String reason,
        List<String> evidence
) {
}
