package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Jev 号码概率校准请求。
 *
 * 校准是外呼密集型操作：耗时约为「期数 × 单次 Jev 调用耗时」，
 * 因此期数上限被硬限制为 20，避免误操作触发长时间外呼。
 *
 * @param issues         参与评估的期数（1-20），空值使用默认 5 期
 * @param baseIssueCount 每期构建特征报告使用的历史期数（20-2000），空值使用默认值
 * @param pickSize       每组号码数量（1-10），空值使用站点默认选4
 */
public record LotteryKl8JevCalibrationRequest(
        @Min(value = 1, message = "校准期数至少 1 期")
        @Max(value = 20, message = "校准期数最多 20 期")
        Integer issues,
        @Min(value = 20, message = "至少需要使用 20 期历史数据")
        @Max(value = 2000, message = "最多使用 2000 期历史数据")
        Integer baseIssueCount,
        @Min(value = 1, message = "每组号码至少 1 个")
        @Max(value = 10, message = "每组号码最多 10 个")
        Integer pickSize
) {
}
