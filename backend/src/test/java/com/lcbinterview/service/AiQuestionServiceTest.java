package com.lcbinterview.service;

import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.AdminAiConfigStatusVO;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * AI 题目生成服务测试，覆盖外部模型调用前的本地配置校验。
 */
class AiQuestionServiceTest {

    @Test
    void configStatusReportsUnavailableWhenApiKeyIsBlank() {
        TestContext context = createService(" ");

        var status = context.service.configStatus();

        assertThat(status.available()).isFalse();
        assertThat(status.apiKeyConfigured()).isFalse();
        assertThat(status.model()).isEqualTo("test-model");
        assertThat(status.endpointHost()).isEqualTo("127.0.0.1");
        assertThat(status.message()).contains("AI_OPENCODE_API_KEY");
    }

    @Test
    void configStatusReportsAvailableWithoutExposingApiKey() {
        TestContext context = createService("test-secret-key");

        var status = context.service.configStatus();

        assertThat(status.available()).isTrue();
        assertThat(status.apiKeyConfigured()).isTrue();
        assertThat(status.model()).isEqualTo("test-model");
        assertThat(status.endpointHost()).isEqualTo("127.0.0.1");
        assertThat(status.toString()).doesNotContain("test-secret-key");
    }

    @Test
    void generateSyncFailsFastWhenApiKeyIsBlank() {
        TestContext context = createService(" ");
        when(context.requestPolicy.clampCount(1)).thenReturn(1);
        when(context.answerQualityPolicy.buildQuestionPrompt(any(GenerationRequest.class))).thenReturn("prompt");

        assertThatThrownBy(() -> context.service.generateSync(
                new GenerationRequest("Java", "MEDIUM", 1, "集合"), 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("AI 生成服务未配置密钥")
                .hasMessageContaining("AI_OPENCODE_API_KEY");

        verifyNoInteractions(context.questionMapper);
    }

    @Test
    void fillAnswerSyncFailsFastWhenApiKeyIsBlank() {
        TestContext context = createService(" ");
        Question question = new Question();
        question.setId(10L);
        question.setCategoryId(1L);
        question.setTitle("HashMap 为什么线程不安全？");

        assertThatThrownBy(() -> context.service.fillAnswerSync(question))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("AI 生成服务未配置密钥")
                .hasMessageContaining("AI_OPENCODE_API_KEY");

        verifyNoInteractions(context.questionMapper);
    }

    private TestContext createService(String apiKey) {
        QuestionMapper questionMapper = mock(QuestionMapper.class);
        CategoryMapper categoryMapper = mock(CategoryMapper.class);
        AiAnswerQualityPolicy answerQualityPolicy = mock(AiAnswerQualityPolicy.class);
        QuestionTitleDeduplicator titleDeduplicator = mock(QuestionTitleDeduplicator.class);
        AiGenerationRequestPolicy requestPolicy = mock(AiGenerationRequestPolicy.class);
        AiRuntimeConfigService aiRuntimeConfigService = mock(AiRuntimeConfigService.class);
        AiRuntimeConfig runtimeConfig = new AiRuntimeConfig(
                apiKey,
                "test-model",
                "http://127.0.0.1:1/v1/chat/completions",
                true);
        when(aiRuntimeConfigService.current()).thenReturn(runtimeConfig);
        when(aiRuntimeConfigService.legacyStatus()).thenReturn(new AdminAiConfigStatusVO(
                runtimeConfig.generationAvailable(),
                runtimeConfig.apiKeyConfigured(),
                runtimeConfig.model(),
                "127.0.0.1",
                runtimeConfig.apiKeyConfigured()
                        ? "AI 生成服务已配置"
                        : "AI 生成服务未配置密钥，请设置 AI_OPENCODE_API_KEY"));
        AiQuestionService service = new AiQuestionService(
                questionMapper,
                categoryMapper,
                mock(CategoryService.class),
                answerQualityPolicy,
                titleDeduplicator,
                requestPolicy,
                aiRuntimeConfigService,
                mock(AiHttpClient.class));
        ReflectionTestUtils.setField(service, "maxTokens", 1000);
        return new TestContext(service, questionMapper, answerQualityPolicy, requestPolicy);
    }

    private record TestContext(
            AiQuestionService service,
            QuestionMapper questionMapper,
            AiAnswerQualityPolicy answerQualityPolicy,
            AiGenerationRequestPolicy requestPolicy
    ) {
    }
}
