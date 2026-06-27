package com.lcbinterview.config;

import com.lcbinterview.common.BusinessException;

/**
 * 当前请求中的普通用户上下文。
 * 使用 ThreadLocal 是为了保持 Controller 和 Service 签名简洁，拦截器会在请求结束时清理。
 */
public final class AuthUserContext {

    private static final ThreadLocal<Long> CURRENT_USER_ID = new ThreadLocal<>();

    private AuthUserContext() {
    }

    /**
     * 绑定当前请求的普通用户 ID。
     *
     * @param userId 普通用户 ID
     */
    public static void setUserId(Long userId) {
        CURRENT_USER_ID.set(userId);
    }

    /**
     * 读取当前请求的普通用户 ID。
     *
     * @return 普通用户 ID
     */
    public static Long currentUserId() {
        Long userId = CURRENT_USER_ID.get();
        if (userId == null) {
            throw new BusinessException(401, "请先登录");
        }
        return userId;
    }

    /**
     * 清理当前请求上下文，避免线程复用时串号。
     */
    public static void clear() {
        CURRENT_USER_ID.remove();
    }
}
