package com.lcbinterview.controller.admin;

import com.lcbinterview.dto.AdminAiConfigStatusVO;
import com.lcbinterview.dto.AdminAiConfigUpdateRequest;
import com.lcbinterview.dto.AdminAiConfigVO;
import com.lcbinterview.dto.BatchFillAnswerRequest;
import com.lcbinterview.dto.BatchGenerationRequest;
import com.lcbinterview.service.AiGenerationRequestPolicy;
import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.AiRuntimeConfigService;
import com.lcbinterview.service.BatchFillAnswerRunner;
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
    private final BatchFillAnswerRunner batchFillAnswerRunner = mock(BatchFillAnswerRunner.class);
    private final AiRuntimeConfigService aiRuntimeConfigService = mock(AiRuntimeConfigService.class);
    private final AiGenerationRequestPolicy requestPolicy = new AiGenerationRequestPolicy();
    private final AiGenerationController controller = new AiGenerationController(
            aiQuestionService, batchGenerationRunner, batchFillAnswerRunner, requestPolicy, aiRuntimeConfigService);

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
    void configReturnsMaskedRuntimeConfiguration() {
        AdminAiConfigVO config = new AdminAiConfigVO(
                true,
                true,
                "sk-l****3456",
                "deepseek-chat",
                "https://api.deepseek.com/v1/chat/completions",
                "api.deepseek.com",
                true,
                "AI 生成服务已配置");
        when(aiRuntimeConfigService.publicConfig()).thenReturn(config);

        var response = controller.config();

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(200);
        assertThat(response.getBody().data()).isSameAs(config);
        assertThat(response.getBody().toString()).doesNotContain("abcdef123456");
        verify(aiRuntimeConfigService).publicConfig();
    }

    @Test
    void updateConfigSavesRuntimeConfiguration() {
        AdminAiConfigUpdateRequest request = new AdminAiConfigUpdateRequest(
                "sk-new-secret",
                "deepseek-chat",
                "https://api.deepseek.com/v1/chat/completions",
                true);
        AdminAiConfigVO saved = new AdminAiConfigVO(
                true,
                true,
                "sk-n****cret",
                "deepseek-chat",
                "https://api.deepseek.com/v1/chat/completions",
                "api.deepseek.com",
                true,
                "AI 生成服务已配置");
        when(aiRuntimeConfigService.save(request)).thenReturn(saved);

        var response = controller.updateConfig(request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(200);
        assertThat(response.getBody().data()).isSameAs(saved);
        verify(aiRuntimeConfigService).save(request);
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
    void batchFillAnswersStartsDefaultAllCategoryTask() {
        when(aiQuestionService.configStatus()).thenReturn(availableAiStatus());
        when(batchFillAnswerRunner.start(null, null, 3)).thenReturn(true);

        var response = controller.batchFillAnswers(new BatchFillAnswerRequest(null, null, null));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(200);
        assertThat(response.getBody().data()).isEqualTo("批量补答案任务已启动");
        verify(batchFillAnswerRunner).start(null, null, 3);
    }

    @Test
    void batchFillAnswersRejectsWhenAiServiceIsUnavailable() {
        when(aiQuestionService.configStatus()).thenReturn(unavailableAiStatus());

        var response = controller.batchFillAnswers(new BatchFillAnswerRequest(null, null, 3));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(503);
        assertThat(response.getBody().message()).contains("AI_OPENCODE_API_KEY");
        verifyNoInteractions(batchFillAnswerRunner);
    }

    @Test
    void batchFillAnswersRejectsWhenTaskAlreadyRunning() {
        when(aiQuestionService.configStatus()).thenReturn(availableAiStatus());
        when(batchFillAnswerRunner.start(3L, 100, 2)).thenReturn(false);

        var response = controller.batchFillAnswers(new BatchFillAnswerRequest(3L, 100, 2));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(409);
        assertThat(response.getBody().message()).isEqualTo("批量补答案任务已在运行中");
        verify(batchFillAnswerRunner).start(3L, 100, 2);
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
