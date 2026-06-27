package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.auth.AuthTokenVO;
import com.lcbinterview.dto.auth.AuthUserVO;
import com.lcbinterview.dto.auth.LoginRequest;
import com.lcbinterview.dto.auth.RegisterRequest;
import com.lcbinterview.service.AppUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 普通用户认证接口。用于个人工具模块登录和注册。
 */
@Tag(name = "普通用户认证")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserService appUserService;

    /**
     * 注册普通用户。
     *
     * @param request 注册请求
     * @return 登录令牌和用户信息
     */
    @Operation(summary = "注册普通用户")
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthTokenVO>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.success(appUserService.register(request)));
    }

    /**
     * 普通用户登录。
     *
     * @param request 登录请求
     * @return 登录令牌和用户信息
     */
    @Operation(summary = "普通用户登录")
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthTokenVO>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success(appUserService.login(request)));
    }

    /**
     * 查询当前普通用户。
     *
     * @return 当前普通用户
     */
    @Operation(summary = "查询当前普通用户")
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<AuthUserVO>> me() {
        return ResponseEntity.ok(ApiResponse.success(appUserService.currentUser(AuthUserContext.currentUserId())));
    }
}
