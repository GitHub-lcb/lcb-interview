package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 批量生成请求参数。
 * @author chongan
 */
@Schema(description = "批量生成请求")
public record BatchGenerationRequest(
        @Min(1) @Max(20) @Schema(description = "每个分类生成数量", defaultValue = "10") Integer countPerCategory,
        @Schema(description = "指定分类名称，为空则生成所有分类") String categoryName,
        @Schema(description = "API 调用间隔（秒），防止限流", defaultValue = "3") Integer delaySeconds
) {
    public BatchGenerationRequest {
        if (countPerCategory == null) {
            countPerCategory = 10;
        }
        if (delaySeconds == null) {
            delaySeconds = 3;
        }
    }
}
