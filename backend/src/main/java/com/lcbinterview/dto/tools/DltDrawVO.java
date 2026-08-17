package com.lcbinterview.dto.tools;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/**
 * 大乐透开奖记录视图。
 */
@Schema(description = "大乐透开奖记录")
public record DltDrawVO(
        String issueNo,
        LocalDate drawDate,
        List<Integer> frontNumbers,
        List<Integer> backNumbers
) {
}
