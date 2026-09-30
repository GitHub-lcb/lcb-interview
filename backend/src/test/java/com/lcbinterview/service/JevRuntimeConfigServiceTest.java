package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8JevStatusVO;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Jev 配置服务测试。
 * 重点：密钥必须脱敏；「能调用」与「能影响推荐」必须是两个独立状态。
 */
class JevRuntimeConfigServiceTest {

    @Test
    void masksApiKeyAndExposesEndpointHost() {
        LotteryKl8JevStatusVO status = config(true, false, "sk-1234567890abcdef")
                .publicStatus();

        assertEquals("sk-1****cdef", status.maskedApiKey());
        assertEquals("api.typesafe.ai", status.endpointHost());
        assertEquals("jev-latest", status.model());
        assertTrue(status.apiKeyConfigured());
        assertTrue(status.available());
        assertFalse(status.scoringAllowed());
    }

    @Test
    void shortApiKeyIsFullyMasked() {
        assertEquals("****", config(true, false, "short").publicStatus().maskedApiKey());
        assertEquals("", config(true, false, "").publicStatus().maskedApiKey());
    }

    @Test
    void disabledConfigReportsGuidanceWithoutLosingKeyState() {
        LotteryKl8JevStatusVO status = config(false, false, "sk-1234567890abcdef").publicStatus();

        assertFalse(status.available());
        assertTrue(status.apiKeyConfigured(), "开关关闭不代表密钥缺失，两者必须分开表达");
        assertTrue(status.message().contains("JEV_ENABLED"), "状态文案要直接给出环境变量名，实际：" + status.message());
    }

    @Test
    void missingKeyReportsItsOwnEnvironmentVariable() {
        LotteryKl8JevStatusVO status = config(true, false, "").publicStatus();

        assertFalse(status.available());
        assertTrue(status.message().contains("TYPESAFE_API_KEY"), "实际：" + status.message());
    }

    @Test
    void scoringGateRequiresBothConfigAndExplicitOptIn() {
        assertFalse(config(true, false, "sk-1234567890abcdef").current().scoringAllowed());
        assertTrue(config(true, true, "sk-1234567890abcdef").current().scoringAllowed());
        // 配置不全时即使显式打开也不能打分
        assertFalse(config(false, true, "sk-1234567890abcdef").current().scoringAllowed());
        assertFalse(config(true, true, "").current().scoringAllowed());
    }

    /**
     * 构造配置服务。
     *
     * @param enabled      是否启用
     * @param allowScoring 是否允许参与打分
     * @param apiKey       密钥
     * @return 配置服务
     */
    private JevRuntimeConfigService config(boolean enabled, boolean allowScoring, String apiKey) {
        return new JevRuntimeConfigService(
                enabled, allowScoring, apiKey, "jev-latest",
                JevRuntimeConfig.DEFAULT_API_URL, 15000L);
    }
}
