package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.membership.CreditBalanceVO;
import com.lcbinterview.dto.membership.CreditTransactionVO;
import com.lcbinterview.service.CreditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 积分接口，提供余额和流水查询。
 */
@Tag(name = "AI 积分")
@RestController
@RequestMapping("/api/credits")
@RequiredArgsConstructor
public class CreditController {

    private final CreditService creditService;

    /**
     * 查询当前用户积分余额。
     *
     * @return 积分余额
     */
    @Operation(summary = "查询积分余额")
    @GetMapping("/balance")
    public ResponseEntity<ApiResponse<CreditBalanceVO>> balance() {
        Long userId = AuthUserContext.currentUserId();
        return ResponseEntity.ok(ApiResponse.success(CreditBalanceVO.from(creditService.account(userId))));
    }

    /**
     * 分页查询当前用户积分流水。
     *
     * @param page 页码，从 0 开始
     * @param size 每页条数
     * @return 积分流水分页结果
     */
    @Operation(summary = "分页查询积分流水")
    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<PageResult<CreditTransactionVO>>> transactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = AuthUserContext.currentUserId();
        var result = creditService.pageTransactions(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success(
                PageResult.of(result, result.getRecords().stream().map(CreditTransactionVO::from).toList())));
    }
}
