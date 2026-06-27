package com.lcbinterview.controller.tools;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotteryKl8DrawVO;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationVO;
import com.lcbinterview.dto.tools.LotteryKl8SyncResultVO;
import com.lcbinterview.dto.tools.LotteryKl8SyncStatusVO;
import com.lcbinterview.service.LotteryKl8RecommendationService;
import com.lcbinterview.service.LotteryKl8SyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 快乐8选5工具接口，提供开奖同步、历史开奖和 AI 推荐能力。
 */
@Tag(name = "快乐8选5工具")
@RestController
@RequestMapping("/api/tools/lottery/kl8")
@RequiredArgsConstructor
public class LotteryKl8Controller {

    private final LotteryKl8SyncService syncService;
    private final LotteryKl8RecommendationService recommendationService;

    /**
     * 手动同步快乐8开奖数据。
     *
     * @return 同步结果
     */
    @Operation(summary = "同步快乐8开奖数据")
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<LotteryKl8SyncResultVO>> sync() {
        return ResponseEntity.ok(ApiResponse.success(syncService.sync()));
    }

    /**
     * 查询快乐8开奖同步状态。
     *
     * @return 同步状态
     */
    @Operation(summary = "查询快乐8同步状态")
    @GetMapping("/sync-status")
    public ResponseEntity<ApiResponse<LotteryKl8SyncStatusVO>> syncStatus() {
        return ResponseEntity.ok(ApiResponse.success(syncService.status()));
    }

    /**
     * 分页查询快乐8近期开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 分页开奖记录
     */
    @Operation(summary = "查询快乐8近期开奖")
    @GetMapping("/draws")
    public ResponseEntity<ApiResponse<PageResult<LotteryKl8DrawVO>>> draws(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(ApiResponse.success(syncService.listDraws(page, size)));
    }

    /**
     * 生成当前用户的快乐8选5推荐。
     *
     * @param request 推荐请求
     * @return 推荐结果
     */
    @Operation(summary = "生成快乐8选5推荐")
    @PostMapping("/recommendations")
    public ResponseEntity<ApiResponse<LotteryKl8RecommendationVO>> recommend(
            @Valid @RequestBody LotteryKl8RecommendationRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.recommend(AuthUserContext.currentUserId(), request)));
    }

    /**
     * 分页查询当前用户的快乐8推荐历史。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 推荐历史
     */
    @Operation(summary = "查询快乐8推荐历史")
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<PageResult<LotteryKl8RecommendationVO>>> recommendations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.list(AuthUserContext.currentUserId(), page, size)));
    }
}
