package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * 模拟战场请求。
 *
 * @param lotteryType 模拟类型：KL8/SSQ/DLT
 * @param windowSize  模拟期数（100-1000）
 */
public record LotterySimulationRequest(
        @NotBlank(message = "模拟类型不能为空")
        String lotteryType,
        @Min(value = 100, message = "模拟期数至少 100 期")
        @Max(value = 1000, message = "模拟期数最多 1000 期")
        Integer windowSize
) {
}
