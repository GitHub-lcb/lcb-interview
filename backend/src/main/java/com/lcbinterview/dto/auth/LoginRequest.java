package com.lcbinterview.dto.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * 普通用户登录请求。
 *
 * @param username 登录用户名
 * @param password 登录密码
 */
public record LoginRequest(
        @NotBlank(message = "用户名不能为空")
        String username,
        @NotBlank(message = "密码不能为空")
        String password
) {
}
