package com.lcbinterview.controller.admin;

import com.lcbinterview.dto.AdminAiConfigStatusVO;
import com.lcbinterview.dto.BatchGenerationRequest;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

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
    void configStatusReturnsAiServiceConfigurationStatus() {
        AdminAiConfigStatusVO status = new AdminAiConfigStatusVO(
                false, false, "glm-5.2", "opencode.ai", "AI 生成服务未配置密钥");
        when(aiQuestionService.configStatus()).thenReturn(status);

        var response = controller.configStatus();

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(200);
        assertThat(response.getBody().data()).isSameAs(status);
        verify(aiQuestionService).configStatus();
    }

    @Test
    void batchGenerateRejectsWhenAiServiceIsUnavailable() {
        AdminAiConfigStatusVO status = new AdminAiConfigStatusVO(
                false, false, "glm-5.2", "opencode.ai", "AI 生成服务未配置密钥，请设置 AI_OPENCODE_API_KEY");
        when(aiQuestionService.configStatus()).thenReturn(status);

        var response = controller.batchGenerate(new BatchGenerationRequest(10, "Java 基础", 3));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(503);
        assertThat(response.getBody().message()).contains("AI_OPENCODE_API_KEY");
        verify(aiQuestionService).configStatus();
        verifyNoInteractions(batchGenerationRunner);
    }

    @Test
    void generateStreamRejectsWhenAiServiceIsUnavailable() {
        when(aiQuestionService.configStatus()).thenReturn(unavailableAiStatus());

        SseEmitter emitter = controller.generateStream("JVM", "MEDIUM", 5, "GC");

        assertThat(emitter.getTimeout()).isZero();
        verify(aiQuestionService).configStatus();
        verifyNoMoreInteractions(aiQuestionService);
    }

    @Test
    void fillAnswerStreamRejectsWhenAiServiceIsUnavailable() {
        when(aiQuestionService.configStatus()).thenReturn(unavailableAiStatus());

        SseEmitter emitter = controller.fillAnswerStream(null, 5);

        assertThat(emitter.getTimeout()).isZero();
        verify(aiQuestionService).configStatus();
        verifyNoMoreInteractions(aiQuestionService);
    }

    @Test
    void rewritePublishedStreamRejectsWhenAiServiceIsUnavailable() {
        when(aiQuestionService.configStatus()).thenReturn(unavailableAiStatus());

        SseEmitter emitter = controller.rewritePublishedStream(3L, "线程池", 4);

        assertThat(emitter.getTimeout()).isZero();
        verify(aiQuestionService).configStatus();
        verifyNoMoreInteractions(aiQuestionService);
    }

    @Test
    void generateStreamUsesLongLivedEmitterForMultiQuestionTasks() {
        when(aiQuestionService.configStatus()).thenReturn(availableAiStatus());

        SseEmitter emitter = controller.generateStream("JVM", "MEDIUM", 5, "GC");

        assertThat(emitter.getTimeout()).isZero();
        ArgumentCaptor<SseEmitter> emitterCaptor = ArgumentCaptor.forClass(SseEmitter.class);
        verify(aiQuestionService).streamGenerate(any(), emitterCaptor.capture());
        assertThat(emitterCaptor.getValue().getTimeout()).isZero();
    }

    @Test
    void fillAnswerStreamUsesLongLivedEmitterForMultiQuestionTasks() {
        when(aiQuestionService.configStatus()).thenReturn(availableAiStatus());

        SseEmitter emitter = controller.fillAnswerStream(null, 5);

        assertThat(emitter.getTimeout()).isZero();
        ArgumentCaptor<SseEmitter> emitterCaptor = ArgumentCaptor.forClass(SseEmitter.class);
        verify(aiQuestionService).streamFillAnswer(any(), any(Integer.class), emitterCaptor.capture());
        assertThat(emitterCaptor.getValue().getTimeout()).isZero();
    }

    @Test
    void rewritePublishedStreamUsesLongLivedEmitterAndDelegatesFilters() {
        when(aiQuestionService.configStatus()).thenReturn(availableAiStatus());

        SseEmitter emitter = controller.rewritePublishedStream(3L, "线程池", 4);

        assertThat(emitter.getTimeout()).isZero();
        ArgumentCaptor<SseEmitter> emitterCaptor = ArgumentCaptor.forClass(SseEmitter.class);
        verify(aiQuestionService).streamRewritePublishedAnswers(
                org.mockito.Mockito.eq(3L),
                org.mockito.Mockito.eq("线程池"),
                org.mockito.Mockito.eq(4),
                emitterCaptor.capture());
        assertThat(emitterCaptor.getValue().getTimeout()).isZero();
    }

    private AdminAiConfigStatusVO availableAiStatus() {
        return new AdminAiConfigStatusVO(true, true, "glm-5.2", "opencode.ai", "AI 生成服务已配置");
    }

    private AdminAiConfigStatusVO unavailableAiStatus() {
        return new AdminAiConfigStatusVO(
                false, false, "glm-5.2", "opencode.ai", "AI 生成服务未配置密钥，请设置 AI_OPENCODE_API_KEY");
    }
}
