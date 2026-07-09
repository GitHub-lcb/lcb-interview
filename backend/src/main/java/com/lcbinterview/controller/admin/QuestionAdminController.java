package com.lcbinterview.controller.admin;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.fasterxml.jackson.databind.JsonNode;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.QuestionAdminVO;
import com.lcbinterview.model.Question;
import com.lcbinterview.service.QuestionAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 管理端题目接口。提供草稿列表、编辑、审核通过和驳回能力。
 */
@Tag(name = "管理端题目")
@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class QuestionAdminController {

    private final QuestionAdminService questionAdminService;

    /**
     * 分页查询草稿题目。
     *
     * @param page 页码，从 0 开始
     * @param size 每页条数
     * @param categoryId 分类 ID，可选
     * @param difficulty 难度，可选
     * @param keyword 关键词，可选
     * @param riskType 风险类型，可选
     * @param contentStatus 内容状态，可选
     * @return 草稿分页结果
     */
    @Operation(summary = "分页查询草稿题目")
    @GetMapping("/draft")
    public ResponseEntity<ApiResponse<IPage<QuestionAdminVO>>> listDrafts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String riskType,
            @RequestParam(required = false) String contentStatus) {
        return ResponseEntity.ok(ApiResponse.success(questionAdminService.listDrafts(
                page, size, categoryId, difficulty, keyword, riskType, contentStatus)));
    }

    /**
     * 查询草稿题目详情。
     *
     * @param id 题目 ID
     * @return 草稿详情
     */
    @Operation(summary = "查询草稿题目详情")
    @GetMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<QuestionAdminVO>> getDraft(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(questionAdminService.getDraft(id)));
    }

    /**
     * 更新草稿题目内容。
     *
     * @param id 题目 ID
     * @param question 草稿内容
     * @return 更新结果
     */
    @Operation(summary = "更新草稿题目")
    @PutMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<Void>> updateDraft(
            @PathVariable Long id,
            @RequestBody Question question) {
        questionAdminService.updateDraft(id, question);
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * 审核通过单个草稿。
     *
     * @param id 草稿题目 ID
     * @return 审核结果
     */
    @Operation(summary = "发布单个草稿")
    @PostMapping("/draft/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approve(@PathVariable Long id) {
        questionAdminService.approve(id);
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * 驳回单个草稿。
     *
     * @param id 题目 ID
     * @param request 可选请求体，clearContent=true 时清空答案
     * @return 驳回结果
     */
    @Operation(summary = "拒绝单个草稿")
    @PostMapping("/draft/{id}/reject")
    public ResponseEntity<ApiResponse<Void>> reject(
            @PathVariable Long id,
            @RequestBody(required = false) JsonNode request) {
        questionAdminService.reject(id, request);
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * 批量审核通过草稿。
     *
     * @param ids 草稿题目 ID 列表
     * @return 批量审核结果
     */
    @Operation(summary = "批量发布草稿")
    @PostMapping("/draft/batch-approve")
    public ResponseEntity<ApiResponse<Void>> batchApprove(@RequestBody List<Long> ids) {
        questionAdminService.batchApprove(ids);
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * 批量驳回草稿。
     *
     * @param request ID 数组，或包含 ids/clearContent 的对象
     * @return 批量驳回结果
     */
    @Operation(summary = "批量拒绝草稿")
    @PostMapping("/draft/batch-reject")
    public ResponseEntity<ApiResponse<Void>> batchReject(@RequestBody JsonNode request) {
        questionAdminService.batchReject(request);
        return ResponseEntity.ok(ApiResponse.success());
    }
}
