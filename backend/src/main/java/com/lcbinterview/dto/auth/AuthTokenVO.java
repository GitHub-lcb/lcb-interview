package com.lcbinterview.dto.auth;

/**
 * 登录成功后的令牌响应。
 *
 * @param token 访问令牌
 * @param user  当前普通用户
 */
public record AuthTokenVO(String token, AuthUserVO user) {
}
