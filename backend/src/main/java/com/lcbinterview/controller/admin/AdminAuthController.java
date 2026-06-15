package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端认证接口。Token 校验由 AdminTokenFilter 统一完成，本控制器只负责返回登录态验证结果。
 */
@Tag(name = "管理端认证")
@RestController
@RequestMapping("/api/admin")
public class AdminAuthController {

    /**
     * 校验当前请求携带的管理员 Token 是否有效。
     *
     * @return 校验成功响应
     */
    @Operation(summary = "校验管理员 Token")
    @GetMapping("/verify")
    public ResponseEntity<ApiResponse<Void>> verify() {
        return ResponseEntity.ok(ApiResponse.success());
    }
}
