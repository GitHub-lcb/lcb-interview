package com.lcbinterview.common;

import java.io.IOException;

/**
 * 请求体超过端点允许的字节数时抛出的异常。
 */
public class PayloadTooLargeException extends IOException {

    /**
     * 创建请求体超限异常。
     *
     * @param message 错误说明
     */
    public PayloadTooLargeException(String message) {
        super(message);
    }
}
