package com.lcbinterview.dto;

import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 通用分页结果。
 * @param <T> 数据类型
 * @author chongan
 */
@Schema(description = "分页结果")
public record PageResult<T>(
        @Schema(description = "数据列表") List<T> content,
        @Schema(description = "当前页码") int page,
        @Schema(description = "每页大小") int size,
        @Schema(description = "总记录数") long total,
        @Schema(description = "总页数") int totalPages
) {
    public static <T> PageResult<T> of(IPage<?> page, List<T> content) {
        return new PageResult<>(
                content, (int) page.getCurrent(), (int) page.getSize(),
                page.getTotal(), (int) page.getPages());
    }
}
