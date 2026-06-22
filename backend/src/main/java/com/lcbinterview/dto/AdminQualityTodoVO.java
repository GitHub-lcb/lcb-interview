package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 管理后台质量待办项，用于把质量指标转成运营人员可以直接处理的动作。
 */
@Schema(description = "管理后台质量待办项")
public record AdminQualityTodoVO(
        @Schema(description = "待办类型") String type,
        @Schema(description = "标题") String title,
        @Schema(description = "详情") String detail,
        @Schema(description = "关联分类 ID") Long categoryId,
        @Schema(description = "关联分类名称") String categoryName,
        @Schema(description = "关联数量") long count,
        @Schema(description = "提示语气：danger/warning/default/success") String tone
) {
}
