package com.lcbinterview.service;

import java.time.LocalDate;
import java.util.List;

/**
 * 抓取器标准化后的快乐8开奖记录。
 *
 * @param issueNo    期号
 * @param drawDate   开奖日期
 * @param numbers    20 个开奖号码
 * @param sourceUrl  来源页面
 * @param sourceName 来源名称
 */
public record LotteryKl8FetchedDraw(
        String issueNo,
        LocalDate drawDate,
        List<Integer> numbers,
        String sourceUrl,
        String sourceName
) {
}
