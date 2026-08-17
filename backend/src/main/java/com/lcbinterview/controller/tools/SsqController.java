package com.lcbinterview.controller.tools;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.SsqDrawVO;
import com.lcbinterview.dto.tools.SsqRecommendationRequest;
import com.lcbinterview.dto.tools.SsqRecommendationVO;
import com.lcbinterview.dto.tools.SsqSyncResultVO;
import com.lcbinterview.dto.tools.SsqSyncStatusVO;
import com.lcbinterview.service.SsqRecommendationEvaluationService;
import com.lcbinterview.service.SsqRecommendationService;
import com.lcbinterview.service.SsqSyncService;
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
 * 双色球工具接口：开奖同步、历史开奖、7 红 1 蓝推荐与命中结算。
 */
@Slf4j
@Tag(name = "双色球工具")
@RestController
@RequestMapping("/api/tools/lottery/ssq")
@RequiredArgsConstructor
public class SsqController {

    private final SsqSyncService syncService;
    private final SsqRecommendationService recommendationService;
    private final SsqRecommendationEvaluationService evaluationService;

    /**
     * 手动同步双色球开奖数据。
     *
     * @return 同步结果
     */
    @Operation(summary = "同步双色球开奖数据")
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<SsqSyncResultVO>> sync() {
        return ResponseEntity.ok(ApiResponse.success(syncService.sync()));
    }

    /**
     * 查询双色球同步状态。
     *
     * @return 同步状态
     */
    @Operation(summary = "查询双色球同步状态")
    @GetMapping("/sync-status")
    public ResponseEntity<ApiResponse<SsqSyncStatusVO>> syncStatus() {
        return ResponseEntity.ok(ApiResponse.success(syncService.status()));
    }

    /**
     * 分页查询双色球近期开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 开奖分页
     */
    @Operation(summary = "查询双色球近期开奖")
    @GetMapping("/draws")
    public ResponseEntity<ApiResponse<PageResult<SsqDrawVO>>> draws(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(ApiResponse.success(syncService.listDraws(page, size)));
    }

    /**
     * 生成当前用户的双色球 7 红 1 蓝推荐。
     *
     * @param request 推荐请求
     * @return 推荐结果
     */
    @Operation(summary = "生成双色球推荐")
    @PostMapping("/recommendations")
    public ResponseEntity<ApiResponse<SsqRecommendationVO>> recommend(
            @Valid @RequestBody(required = false) SsqRecommendationRequest request) {
        Integer baseIssueCount = request == null ? null : request.baseIssueCount();
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.recommend(AuthUserContext.currentUserId(), baseIssueCount)));
    }

    /**
     * 分页查询当前用户的双色球推荐历史。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 推荐历史
     */
    @Operation(summary = "查询双色球推荐历史")
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<PageResult<SsqRecommendationVO>>> recommendations(
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
    @Operation(summary = "手动结算双色球推荐命中")
    @PostMapping("/evaluate")
    public ResponseEntity<ApiResponse<Integer>> evaluate() {
        int evaluated = evaluationService.evaluatePendingRecommendations();
        log.info("手动结算双色球推荐命中: {} 条", evaluated);
        return ResponseEntity.ok(ApiResponse.success(evaluated));
    }
}
