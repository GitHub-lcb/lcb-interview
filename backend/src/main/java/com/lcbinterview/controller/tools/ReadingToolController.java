package com.lcbinterview.controller.tools;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.MarkdownExportVO;
import com.lcbinterview.dto.tools.ReadingExcerptCreateRequest;
import com.lcbinterview.dto.tools.ReadingExcerptQuery;
import com.lcbinterview.dto.tools.ReadingExcerptUpdateRequest;
import com.lcbinterview.dto.tools.ReadingExcerptVO;
import com.lcbinterview.service.ReadingExcerptService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 读书工具接口，提供当前普通用户的书摘管理能力。
 */
@Tag(name = "读书工具")
@RestController
@RequestMapping("/api/tools/reading/excerpts")
@RequiredArgsConstructor
public class ReadingToolController {

    private final ReadingExcerptService readingExcerptService;

    /**
     * 分页查询当前用户书摘。
     *
     * @param query 查询条件
     * @return 分页书摘
     */
    @Operation(summary = "分页查询书摘")
    @GetMapping
    public ResponseEntity<ApiResponse<PageResult<ReadingExcerptVO>>> list(ReadingExcerptQuery query) {
        return ResponseEntity.ok(ApiResponse.success(
                readingExcerptService.list(AuthUserContext.currentUserId(), query)));
    }

    /**
     * 新增当前用户书摘。
     *
     * @param request 新增请求
     * @return 新增后的书摘
     */
    @Operation(summary = "新增书摘")
    @PostMapping
    public ResponseEntity<ApiResponse<ReadingExcerptVO>> create(@Valid @RequestBody ReadingExcerptCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                readingExcerptService.create(AuthUserContext.currentUserId(), request)));
    }

    /**
     * 更新当前用户书摘。
     *
     * @param id      书摘 ID
     * @param request 更新请求
     * @return 更新后的书摘
     */
    @Operation(summary = "更新书摘")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ReadingExcerptVO>> update(
            @PathVariable Long id,
            @Valid @RequestBody ReadingExcerptUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                readingExcerptService.update(AuthUserContext.currentUserId(), id, request)));
    }

    /**
     * 删除当前用户书摘。
     *
     * @param id 书摘 ID
     * @return 空响应
     */
    @Operation(summary = "删除书摘")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        readingExcerptService.delete(AuthUserContext.currentUserId(), id);
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * 导出当前筛选结果为 Markdown。
     *
     * @param query 查询条件
     * @return Markdown 导出内容
     */
    @Operation(summary = "导出书摘 Markdown")
    @GetMapping("/export")
    public ResponseEntity<ApiResponse<MarkdownExportVO>> export(ReadingExcerptQuery query) {
        return ResponseEntity.ok(ApiResponse.success(
                readingExcerptService.exportMarkdown(AuthUserContext.currentUserId(), query)));
    }
}
