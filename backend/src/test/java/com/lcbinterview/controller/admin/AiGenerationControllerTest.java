package com.lcbinterview.controller.admin;

import com.lcbinterview.service.AiGenerationRequestPolicy;
import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.BatchGenerationRunner;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * AI 生成控制器测试，验证长耗时流式任务不会被固定 SSE 超时提前截断。
 */
class AiGenerationControllerTest {

    private final AiQuestionService aiQuestionService = mock(AiQuestionService.class);
    private final BatchGenerationRunner batchGenerationRunner = mock(BatchGenerationRunner.class);
    private final AiGenerationRequestPolicy requestPolicy = new AiGenerationRequestPolicy();
    private final AiGenerationController controller = new AiGenerationController(
            aiQuestionService, batchGenerationRunner, requestPolicy);

    @Test
    void generateStreamUsesLongLivedEmitterForMultiQuestionTasks() {
        SseEmitter emitter = controller.generateStream("JVM", "MEDIUM", 5, "GC");

        assertThat(emitter.getTimeout()).isZero();
        ArgumentCaptor<SseEmitter> emitterCaptor = ArgumentCaptor.forClass(SseEmitter.class);
        verify(aiQuestionService).streamGenerate(any(), emitterCaptor.capture());
        assertThat(emitterCaptor.getValue().getTimeout()).isZero();
    }

    @Test
    void fillAnswerStreamUsesLongLivedEmitterForMultiQuestionTasks() {
        SseEmitter emitter = controller.fillAnswerStream(null, 5);

        assertThat(emitter.getTimeout()).isZero();
        ArgumentCaptor<SseEmitter> emitterCaptor = ArgumentCaptor.forClass(SseEmitter.class);
        verify(aiQuestionService).streamFillAnswer(any(), any(Integer.class), emitterCaptor.capture());
        assertThat(emitterCaptor.getValue().getTimeout()).isZero();
    }
}
