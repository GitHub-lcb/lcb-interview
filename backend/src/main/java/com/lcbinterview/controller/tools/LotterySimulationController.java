package com.lcbinterview.controller.tools;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotterySimulationRequest;
import com.lcbinterview.dto.tools.LotterySimulationVO;
import com.lcbinterview.service.LotterySimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 模拟战场接口：对最近 N 期逐期滚动预测并结算，统计预测算法命中表现。
 */
@Slf4j
@Tag(name = "模拟战场")
@RestController
@RequestMapping("/api/tools/lottery/simulation")
@RequiredArgsConstructor
public class LotterySimulationController {

    private final LotterySimulationService simulationService;

    /**
     * 执行一次模拟并保存结果。
     *
     * @param request 模拟请求
     * @return 模拟结果
     */
    @Operation(summary = "执行号码预测模拟")
    @PostMapping
    public ResponseEntity<ApiResponse<LotterySimulationVO>> run(
            @Valid @RequestBody LotterySimulationRequest request) {
        LotterySimulationVO result = simulationService.run(
                AuthUserContext.currentUserId(), request.lotteryType(), request.windowSize());
        log.info("模拟战场执行完成: type={}, window={}", request.lotteryType(), request.windowSize());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 分页查询当前用户的模拟记录。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 模拟记录分页
     */
    @Operation(summary = "查询模拟历史")
    @GetMapping
    public ResponseEntity<ApiResponse<PageResult<LotterySimulationVO>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                simulationService.list(AuthUserContext.currentUserId(), page, size)));
    }

    /**
     * 查询单条模拟记录。
     *
     * @param id 模拟 ID
     * @return 模拟详情
     */
    @Operation(summary = "查询模拟详情")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LotterySimulationVO>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                simulationService.get(AuthUserContext.currentUserId(), id)));
    }
}
