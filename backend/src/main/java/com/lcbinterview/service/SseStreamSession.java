package com.lcbinterview.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * SSE 流式会话，统一维护浏览器连接状态和发送失败后的停止信号。
 */
@Slf4j
class SseStreamSession {

    private final SseEmitter emitter;
    private final AtomicBoolean open = new AtomicBoolean(true);
    private final AtomicBoolean closeLogged = new AtomicBoolean(false);

    private SseStreamSession(SseEmitter emitter) {
        this.emitter = emitter;
    }

    static SseStreamSession open(SseEmitter emitter) {
        SseStreamSession session = new SseStreamSession(emitter);
        emitter.onCompletion(() -> session.markClosed("completion", null));
        emitter.onTimeout(() -> session.markClosed("timeout", null));
        emitter.onError(error -> session.markClosed("error", error));
        return session;
    }

    boolean isOpen() {
        return open.get();
    }

    boolean sendEvent(String name, String data) {
        if (!isOpen()) {
            return false;
        }
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
            return true;
        } catch (Exception e) {
            markClosed("send failed: " + name, e);
            return false;
        }
    }

    boolean sendJson(String name, Object body, ObjectMapper objectMapper) {
        try {
            return sendEvent(name, objectMapper.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            log.warn("序列化 SSE 事件 '{}' 失败: {}", name, e.getMessage());
            return false;
        }
    }

    void complete() {
        if (open.compareAndSet(true, false)) {
            try {
                emitter.complete();
            } catch (Exception ignored) {
            }
        }
    }

    void completeWithError(Throwable error) {
        if (open.compareAndSet(true, false)) {
            try {
                emitter.completeWithError(error);
            } catch (Exception ignored) {
            }
        }
    }

    private void markClosed(String reason, Throwable error) {
        open.set(false);
        if (closeLogged.compareAndSet(false, true)) {
            if (error == null) {
                log.info("SSE 连接已关闭: {}", reason);
            } else {
                log.warn("SSE 连接已关闭: {}, error={}", reason, error.getMessage());
            }
        }
    }
}
