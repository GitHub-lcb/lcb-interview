package com.lcbinterview.service;

import com.lcbinterview.dto.AdminAiConfigUpdateRequest;
import com.lcbinterview.dto.AdminAiConfigVO;
import com.lcbinterview.mapper.AiConfigMapper;
import com.lcbinterview.model.AiConfig;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI 运行时配置服务测试，验证数据库配置优先、环境变量兜底以及密钥脱敏。
 */
class AiRuntimeConfigServiceTest {

    @Test
    void publicConfigUsesDatabaseConfigAndMasksApiKey() {
        AiConfigMapper mapper = mock(AiConfigMapper.class);
        AiConfig stored = config(
                "sk-live-abcdef123456",
                "deepseek-chat",
                "https://api.deepseek.com/v1/chat/completions",
                false);
        when(mapper.selectById(1L)).thenReturn(stored);

        AdminAiConfigVO publicConfig = service(mapper).publicConfig();

        assertThat(publicConfig.available()).isTrue();
        assertThat(publicConfig.apiKeyConfigured()).isTrue();
        assertThat(publicConfig.maskedApiKey()).isEqualTo("sk-l****3456");
        assertThat(publicConfig.model()).isEqualTo("deepseek-chat");
        assertThat(publicConfig.apiUrl()).isEqualTo("https://api.deepseek.com/v1/chat/completions");
        assertThat(publicConfig.endpointHost()).isEqualTo("api.deepseek.com");
        assertThat(publicConfig.interviewEnabled()).isFalse();
        assertThat(publicConfig.toString()).doesNotContain("sk-live-abcdef123456");
    }

    @Test
    void currentFallsBackToEnvironmentWhenDatabaseConfigIsMissing() {
        AiConfigMapper mapper = mock(AiConfigMapper.class);
        when(mapper.selectById(1L)).thenReturn(null);

        AiRuntimeConfig current = service(mapper).current();

        assertThat(current.apiKey()).isEqualTo("env-secret-key");
        assertThat(current.model()).isEqualTo("env-model");
        assertThat(current.apiUrl()).isEqualTo("https://env.example/v1/chat/completions");
        assertThat(current.interviewEnabled()).isTrue();
    }

    @Test
    void savePreservesExistingApiKeyWhenRequestApiKeyIsBlank() {
        AiConfigMapper mapper = mock(AiConfigMapper.class);
        AiConfig stored = config(
                "sk-old-secret",
                "old-model",
                "https://old.example/v1/chat/completions",
                false);
        when(mapper.selectById(1L)).thenReturn(stored);

        service(mapper).save(new AdminAiConfigUpdateRequest(
                " ",
                "new-model",
                "https://new.example/v1/chat/completions",
                true));

        ArgumentCaptor<AiConfig> captor = ArgumentCaptor.forClass(AiConfig.class);
        verify(mapper).updateById(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(1L);
        assertThat(captor.getValue().getApiKey()).isEqualTo("sk-old-secret");
        assertThat(captor.getValue().getModel()).isEqualTo("new-model");
        assertThat(captor.getValue().getApiUrl()).isEqualTo("https://new.example/v1/chat/completions");
        assertThat(captor.getValue().getInterviewEnabled()).isTrue();
    }

    private AiRuntimeConfigService service(AiConfigMapper mapper) {
        return new AiRuntimeConfigService(
                mapper,
                "env-secret-key",
                "env-model",
                "https://env.example/v1/chat/completions",
                true);
    }

    private AiConfig config(String apiKey, String model, String apiUrl, boolean interviewEnabled) {
        AiConfig config = new AiConfig();
        config.setId(1L);
        config.setApiKey(apiKey);
        config.setModel(model);
        config.setApiUrl(apiUrl);
        config.setInterviewEnabled(interviewEnabled);
        return config;
    }
}
