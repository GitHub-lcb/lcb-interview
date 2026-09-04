package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.membership.OrderCreateRequest;
import com.lcbinterview.dto.membership.OrderVO;
import com.lcbinterview.model.UserOrder;
import com.lcbinterview.service.OrderService;
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
 * 订单接口，提供订阅/积分包下单、模拟支付回调和订单查询。
 * 真实支付渠道接入前，mock-pay-callback 用于打通支付闭环。
 */
@Slf4j
@Tag(name = "订单")
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * 创建待支付订单。
     *
     * @param request 下单请求
     * @return 订单信息
     */
    @Operation(summary = "创建订单")
    @PostMapping
    public ResponseEntity<ApiResponse<OrderVO>> create(@Valid @RequestBody OrderCreateRequest request) {
        Long userId = AuthUserContext.currentUserId();
        UserOrder order = orderService.createOrder(userId, request.planCode());
        return ResponseEntity.ok(ApiResponse.success(OrderVO.from(order)));
    }

    /**
     * 模拟支付成功回调，幂等处理。真实支付渠道接入后由渠道异步通知替换。
     *
     * @param orderNo 订单号
     * @return 支付后的订单信息
     */
    @Operation(summary = "模拟支付成功回调")
    @PostMapping("/{orderNo}/mock-pay-callback")
    public ResponseEntity<ApiResponse<OrderVO>> mockPayCallback(@PathVariable String orderNo) {
        Long userId = AuthUserContext.currentUserId();
        UserOrder order = orderService.mockPayCallback(userId, orderNo);
        log.info("模拟支付回调完成: orderNo={}, status={}", orderNo, order.getStatus());
        return ResponseEntity.ok(ApiResponse.success(OrderVO.from(order)));
    }

    /**
     * 分页查询当前用户订单。
     *
     * @param page 页码，从 0 开始
     * @param size 每页条数
     * @return 订单分页结果
     */
    @Operation(summary = "分页查询我的订单")
    @GetMapping
    public ResponseEntity<ApiResponse<PageResult<OrderVO>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = AuthUserContext.currentUserId();
        var result = orderService.pageOrders(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success(
                PageResult.of(result, result.getRecords().stream().map(OrderVO::from).toList())));
    }
}
