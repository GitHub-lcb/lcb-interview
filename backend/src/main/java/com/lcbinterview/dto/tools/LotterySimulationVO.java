package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 模拟战场结果视图。
 *
 * @param id            模拟 ID
 * @param lotteryType   模拟类型：KL8/SSQ/DLT
 * @param windowSize    模拟期数
 * @param leadHistory   每期预测使用的前置历史期数
 * @param startIssueNo  模拟起始期号
 * @param endIssueNo    模拟结束期号
 * @param evaluatedCount 实际结算期数
 * @param totalHits     总命中数
 * @param avgHits       平均命中
 * @param hitRate       至少命中 1 个的比例（%）
 * @param zeroHitCount  全不中期数
 * @param maxHits       单期最高命中
 * @param secondaryAvg  次维度平均命中
 * @param hit4Count     KL8 单组全中 4 个的期数
 * @param hitDistribution 主维度命中数分布 JSON（{"0":5,"1":20,"2":40}）
 * @param summary       统计摘要
 * @param createdAt     创建时间
 */
@Schema(description = "模拟战场结果")
public record LotterySimulationVO(
        Long id,
        String lotteryType,
        Integer windowSize,
        Integer leadHistory,
        String startIssueNo,
        String endIssueNo,
        Integer evaluatedCount,
        Integer totalHits,
        BigDecimal avgHits,
        BigDecimal hitRate,
        Integer zeroHitCount,
        Integer maxHits,
        BigDecimal secondaryAvg,
        Integer hit4Count,
        String hitDistribution,
        String summary,
        LocalDateTime createdAt
) {
}
