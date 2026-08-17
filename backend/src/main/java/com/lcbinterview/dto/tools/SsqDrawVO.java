package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/**
 * 双色球开奖记录视图。
 *
 * @param issueNo    期号
 * @param drawDate   开奖日期
 * @param redNumbers 6 个红球
 * @param blueNumber 1 个蓝球
 */
@Schema(description = "双色球开奖记录")
public record SsqDrawVO(
        String issueNo,
        LocalDate drawDate,
        java.util.List<Integer> redNumbers,
        Integer blueNumber
) {
}
