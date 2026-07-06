package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8共现参考结果，保留旧推荐记录的对子结算兼容能力。
 *
 * @param leftNumber  较小号码
 * @param rightNumber 较大号码
 * @param count       基准期内共现次数
 * @param lift        相对独立出现的提升度
 * @param score       共现综合分
 * @param selected    是否进入本次最终 5 码组合，旧记录可能为 true，新邻位策略默认不再强制入选
 * @param reason      参考理由
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
