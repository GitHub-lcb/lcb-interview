package com.lcbinterview.dto.tools;

import com.lcbinterview.model.LotteryKl8Draw;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

/**
 * 快乐8开奖记录展示对象。
 *
 * @param issueNo    期号
 * @param drawDate   开奖日期
 * @param numbers    20 个开奖号码
 * @param sourceName 来源名称
 */
public record LotteryKl8DrawVO(String issueNo, LocalDate drawDate, List<Integer> numbers, String sourceName) {

    /**
     * 从开奖记录实体创建展示对象。
     *
     * @param draw 开奖记录
     * @return 开奖记录展示对象
     */
    public static LotteryKl8DrawVO from(LotteryKl8Draw draw) {
        return new LotteryKl8DrawVO(draw.getIssueNo(), draw.getDrawDate(), parseNumbers(draw.getNumbers()), draw.getSourceName());
    }

    private static List<Integer> parseNumbers(String numbers) {
        if (numbers == null || numbers.isBlank()) {
            return List.of();
        }
        return Arrays.stream(numbers.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(Integer::parseInt)
                .toList();
    }
}
