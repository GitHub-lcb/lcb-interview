package com.lcbinterview.controller.tools;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.DltDrawVO;
import com.lcbinterview.dto.tools.DltRecommendationRequest;
import com.lcbinterview.dto.tools.DltRecommendationVO;
import com.lcbinterview.dto.tools.DltSyncResultVO;
import com.lcbinterview.dto.tools.DltSyncStatusVO;
import com.lcbinterview.service.DltRecommendationEvaluationService;
import com.lcbinterview.service.DltRecommendationService;
import com.lcbinterview.service.DltSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 大乐透工具接口：开奖同步、历史开奖、5 前区 + 3 后区推荐与命中结算。
 */
@Slf4j
@Tag(name = "大乐透工具")
@RestController
@RequestMapping("/api/tools/lottery/dlt")
@RequiredArgsConstructor
public class DltController {

    private final DltSyncService syncService;
    private final DltRecommendationService recommendationService;
    private final DltRecommendationEvaluationService evaluationService;

    /**
     * 手动同步大乐透开奖数据。
     *
     * @return 同步结果
     */
    @Operation(summary = "同步大乐透开奖数据")
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<DltSyncResultVO>> sync() {
        return ResponseEntity.ok(ApiResponse.success(syncService.sync()));
    }

    /**
     * 查询大乐透同步状态。
     *
     * @return 同步状态
     */
    @Operation(summary = "查询大乐透同步状态")
    @GetMapping("/sync-status")
    public ResponseEntity<ApiResponse<DltSyncStatusVO>> syncStatus() {
        return ResponseEntity.ok(ApiResponse.success(syncService.status()));
    }

    /**
     * 分页查询大乐透近期开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 开奖分页
     */
    @Operation(summary = "查询大乐透近期开奖")
    @GetMapping("/draws")
    public ResponseEntity<ApiResponse<PageResult<DltDrawVO>>> draws(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(ApiResponse.success(syncService.listDraws(page, size)));
    }

    /**
     * 生成当前用户的大乐透 5 前区 + 3 后区推荐。
     *
     * @param request 推荐请求
     * @return 推荐结果
     */
    @Operation(summary = "生成大乐透推荐")
    @PostMapping("/recommendations")
    public ResponseEntity<ApiResponse<DltRecommendationVO>> recommend(
            @Valid @RequestBody(required = false) DltRecommendationRequest request) {
        Integer baseIssueCount = request == null ? null : request.baseIssueCount();
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.recommend(AuthUserContext.currentUserId(), baseIssueCount)));
    }

    /**
     * 分页查询当前用户的大乐透推荐历史。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 推荐历史
     */
    @Operation(summary = "查询大乐透推荐历史")
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<PageResult<DltRecommendationVO>>> recommendations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.list(AuthUserContext.currentUserId(), page, size)));
    }

    /**
     * 手动结算所有待结算推荐。
     *
     * @return 本次结算条数
     */
    @Operation(summary = "手动结算大乐透推荐命中")
    @PostMapping("/evaluate")
    public ResponseEntity<ApiResponse<Integer>> evaluate() {
        int evaluated = evaluationService.evaluatePendingRecommendations();
        log.info("手动结算大乐透推荐命中: {} 条", evaluated);
        return ResponseEntity.ok(ApiResponse.success(evaluated));
    }
}
