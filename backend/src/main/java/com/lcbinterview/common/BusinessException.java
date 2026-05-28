package com.lcbinterview.common;

import lombok.Getter;

/**
 * 业务异常。由 GlobalExceptionHandler 统一捕获处理。
 * @author chongan
 */
@Getter
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message) {
        super(message);
        this.code = 400;
    }
}
