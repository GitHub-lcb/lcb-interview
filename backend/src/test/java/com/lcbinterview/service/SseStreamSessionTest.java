package com.lcbinterview.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SSE 会话状态测试，确保浏览器断开后后台流式任务能及时停止。
 */
class SseStreamSessionTest {

    @Test
    void sendEventReturnsFalseAndClosesSessionWhenEmitterIsAlreadyCompleted() {
        FailingEmitter emitter = new FailingEmitter();
        SseStreamSession session = SseStreamSession.open(emitter);

        boolean sent = session.sendEvent("thinking", "token");

        assertThat(sent).isFalse();
        assertThat(session.isOpen()).isFalse();
        assertThat(emitter.sendCount).isEqualTo(1);
    }

    @Test
    void sendEventSkipsEmitterAfterSessionHasBeenClosed() {
        FailingEmitter emitter = new FailingEmitter();
        SseStreamSession session = SseStreamSession.open(emitter);

        session.sendEvent("thinking", "first");
        boolean sentAgain = session.sendEvent("thinking", "second");

        assertThat(sentAgain).isFalse();
        assertThat(emitter.sendCount).isEqualTo(1);
    }

    private static class FailingEmitter extends SseEmitter {
        private int sendCount;

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            sendCount++;
            throw new IllegalStateException("ResponseBodyEmitter has already completed");
        }
    }
}
