package com.lcbinterview.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 普通用户注册请求。
 *
 * @param username    登录用户名
 * @param password    登录密码
 * @param displayName 展示昵称
 */
public record RegisterRequest(
        @NotBlank(message = "用户名不能为空")
        @Size(min = 3, max = 32, message = "用户名长度必须在 3 到 32 位之间")
        String username,
        @NotBlank(message = "密码不能为空")
        @Size(min = 8, max = 72, message = "密码长度必须在 8 到 72 位之间")
        String password,
        @Size(max = 64, message = "昵称不能超过 64 位")
        String displayName
) {
}
