package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8JevStatusVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Jev 决策模型配置服务。
 *
 * 配置来源为部署环境变量（经 application.yml 的 ai.jev.* 绑定），不落库：
 * Jev 是外部决策层，密钥与端点属于部署环境信息，避免在生产库里堆积第三方密钥；
 * 与 {@link AiRuntimeConfigService}（OpenAI 兼容生成式 AI）保持相互独立，
 * 两者任一缺失都不影响另一条链路。
 */
@Service
public class JevRuntimeConfigService {

    private final JevRuntimeConfig config;

    /**
     * 创建 Jev 配置服务。
     *
     * @param enabled      是否启用 Jev 决策层，对应 JEV_ENABLED
     * @param allowScoring 是否允许 Jev 概率参与推荐排序，对应 JEV_ALLOW_SCORING
     * @param apiKey       API Key，对应 TYPESAFE_API_KEY
     * @param model        模型标识，对应 JEV_MODEL
     * @param apiUrl       System One 端点，对应 JEV_URL
     * @param timeoutMs    单次调用超时，对应 JEV_TIMEOUT_MS
     * @param promptLocale 提示词语言，对应 JEV_PROMPT_LOCALE
     */
    @Autowired
    public JevRuntimeConfigService(
            @Value("${ai.jev.enabled:false}") boolean enabled,
            @Value("${ai.jev.allow-scoring:false}") boolean allowScoring,
            @Value("${ai.jev.api-key:}") String apiKey,
            @Value("${ai.jev.model:jev-latest}") String model,
            @Value("${ai.jev.url:https://api.typesafe.ai/v1/systemone}") String apiUrl,
            @Value("${ai.jev.timeout-ms:15000}") long timeoutMs,
            @Value("${ai.jev.prompt-locale:zh}") String promptLocale) {
        this.config = new JevRuntimeConfig(
                normalize(apiKey),
                StringUtils.hasText(model) ? model.trim() : JevRuntimeConfig.DEFAULT_MODEL,
                StringUtils.hasText(apiUrl) ? apiUrl.trim() : JevRuntimeConfig.DEFAULT_API_URL,
                enabled,
                allowScoring,
                timeoutMs > 0 ? timeoutMs : 15000L,
                JevPromptLocale.parse(promptLocale));
    }

    /**
     * 供测试使用的构造器：提示词语言固定为中文。
     *
     * @param enabled      是否启用 Jev 决策层
     * @param allowScoring 是否允许 Jev 概率参与推荐排序
     * @param apiKey       API Key
     * @param model        模型标识
     * @param apiUrl       System One 端点
     * @param timeoutMs    单次调用超时
     */
    JevRuntimeConfigService(
            boolean enabled,
            boolean allowScoring,
            String apiKey,
            String model,
            String apiUrl,
            long timeoutMs) {
        this(enabled, allowScoring, apiKey, model, apiUrl, timeoutMs, "zh");
    }

    /**
     * 查询当前生效配置，含密钥原文，禁止直接序列化返回前端。
     *
     * @return 当前 Jev 配置
     */
    public JevRuntimeConfig current() {
        return config;
    }

    /**
     * 生成可对外展示的状态对象，密钥已脱敏。
     *
     * @return Jev 配置状态
     */
    public LotteryKl8JevStatusVO publicStatus() {
        return new LotteryKl8JevStatusVO(
                config.enabled(),
                config.callable(),
                config.scoringAllowed(),
                config.apiKeyConfigured(),
                config.maskedApiKey(),
                config.model(),
                config.endpointHost(),
                config.timeoutMs(),
                config.promptLocaleCode(),
                statusMessage());
    }

    /**
     * 生成中文状态说明，直接指出缺失项与对应的环境变量名，便于部署排查。
     *
     * @return 中文状态文案
     */
    private String statusMessage() {
        if (!config.enabled()) {
            return "Jev 决策层未启用，设置 JEV_ENABLED=true 后生效";
        }
        if (!config.apiKeyConfigured()) {
            return "Jev 未配置密钥，请设置 TYPESAFE_API_KEY";
        }
        if (!config.modelConfigured()) {
            return "Jev 未配置模型，请设置 JEV_MODEL（默认 jev-latest）";
        }
        if (!config.endpointConfigured()) {
            return "Jev 未配置接口地址，请设置 JEV_URL";
        }
        if (!config.allowScoring()) {
            return "Jev 决策层已配置，可用于号码概率推算；概率尚未获准影响推荐排序，"
                    + "需先通过校准接口确认无显著优势后再设置 JEV_ALLOW_SCORING=true";
        }
        return "Jev 决策层已配置，且已获准参与推荐排序";
    }

    private static String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }
}
