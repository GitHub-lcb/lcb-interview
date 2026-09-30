package com.lcbinterview.service;

import org.springframework.util.StringUtils;

/**
 * Jev（TypeSafe System One）决策模型运行时配置。
 *
 * Jev 不是语言模型：它接收「状态 + 类型化问题」，返回类型化答案与校准概率，
 * 因此本配置不包含 temperature、max-tokens 这类生成式参数。
 * 内部包含密钥原文，只允许在服务层传递。
 *
 * @param apiKey       API Key 原文
 * @param model        模型标识，如 jev-latest
 * @param apiUrl       System One 单端点地址
 * @param enabled      是否启用 Jev 决策层
 * @param allowScoring 是否允许 Jev 概率参与推荐排序，默认关闭
 * @param timeoutMs    单次调用超时（毫秒）
 * @param promptLocale 送模型的提示词语言，默认中文
 */
public record JevRuntimeConfig(
        String apiKey,
        String model,
        String apiUrl,
        boolean enabled,
        boolean allowScoring,
        long timeoutMs,
        JevPromptLocale promptLocale
) {

    /** 默认端点：TypeSafe System One 把所有问题收敛到这一个地址。 */
    public static final String DEFAULT_API_URL = "https://api.typesafe.ai/v1/systemone";

    /** 默认模型别名 aliases 由服务端滚动更新，固定版本号反而会失效。 */
    public static final String DEFAULT_MODEL = "jev-latest";

    /**
     * 兼容不含提示词语言的调用方，默认按中文渲染。
     *
     * @param apiKey       API Key 原文
     * @param model        模型标识
     * @param apiUrl       System One 端点
     * @param enabled      是否启用
     * @param allowScoring 是否允许参与推荐排序
     * @param timeoutMs    单次调用超时
     */
    public JevRuntimeConfig(
            String apiKey,
            String model,
            String apiUrl,
            boolean enabled,
            boolean allowScoring,
            long timeoutMs) {
        this(apiKey, model, apiUrl, enabled, allowScoring, timeoutMs, JevPromptLocale.ZH);
    }

    /**
     * 提示词语言代码，供状态接口展示。
     *
     * @return zh 或 en
     */
    public String promptLocaleCode() {
        return promptLocale == null ? JevPromptLocale.ZH.code() : promptLocale.code();
    }

    /**
     * 判断 API Key 是否已配置。
     *
     * @return true 表示密钥非空
     */
    public boolean apiKeyConfigured() {
        return StringUtils.hasText(apiKey);
    }

    /**
     * 判断模型标识是否已配置。
     *
     * @return true 表示模型非空
     */
    public boolean modelConfigured() {
        return StringUtils.hasText(model);
    }

    /**
     * 判断端点地址是否已配置。
     *
     * @return true 表示地址非空
     */
    public boolean endpointConfigured() {
        return StringUtils.hasText(apiUrl);
    }

    /**
     * 判断当前是否具备发起 Jev 调用的条件。
     * 四个条件缺一不可：开关打开、密钥、模型、地址。
     *
     * @return true 表示可以调用
     */
    public boolean callable() {
        return enabled && apiKeyConfigured() && modelConfigured() && endpointConfigured();
    }

    /**
     * 判断 Jev 概率是否获准参与推荐排序。
     *
     * 这是一道人工闸门而非自动结论：单号真实概率恒为 0.25，
     * Jev 的概率推算在没有通过校准显著优于随机基线之前，只能作为观察项，
     * 不允许影响实际推荐号码，避免把「模型信念」包装成「预测能力」。
     *
     * @return true 表示可影响推荐排序
     */
    public boolean scoringAllowed() {
        return callable() && allowScoring;
    }

    /**
     * 返回脱敏后的密钥，仅用于状态展示，禁止用于调用。
     *
     * @return 形如 abcd****wxyz 的脱敏串
     */
    public String maskedApiKey() {
        if (!apiKeyConfigured()) {
            return "";
        }
        String trimmed = apiKey.trim();
        if (trimmed.length() <= 8) {
            return "****";
        }
        return trimmed.substring(0, 4) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    /**
     * 解析端点主机名，仅用于状态展示与日志，避免把完整地址写进前端。
     *
     * @return 主机名，解析失败时返回空串
     */
    public String endpointHost() {
        if (!endpointConfigured()) {
            return "";
        }
        try {
            String host = java.net.URI.create(apiUrl).getHost();
            return host == null ? "" : host;
        } catch (IllegalArgumentException e) {
            return "";
        }
    }
}
