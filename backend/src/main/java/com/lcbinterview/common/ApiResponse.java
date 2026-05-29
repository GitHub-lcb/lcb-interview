package com.lcbinterview.common;

import org.springframework.http.HttpStatus;

/**
 * 统一响应结构。所有 API 返回此格式。
 * @param code    状态码（200 成功，其余为错误）
 * @param message 提示信息
 * @param data    响应数据
 * @author chongan
 */
public record ApiResponse<T>(int code, String message, T data) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(200, "success", null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> error(HttpStatus status, String message) {
        return new ApiResponse<>(status.value(), message, null);
    }
}
