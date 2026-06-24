package com.lcbinterview.service;

import org.springframework.util.StringUtils;

/**
 * AI 调用时实际生效的运行时配置，内部包含密钥原文，只允许在服务层传递。
 *
 * @param apiKey           API Key 原文
 * @param model            模型名称
 * @param apiUrl           OpenAI 兼容接口地址
 * @param interviewEnabled 是否启用面试训练 AI 评分
 */
public record AiRuntimeConfig(
        String apiKey,
        String model,
        String apiUrl,
        boolean interviewEnabled
) {

    /**
     * 判断 API Key 是否已配置。
     *
     * @return true 表示 API Key 非空
     */
    public boolean apiKeyConfigured() {
        return StringUtils.hasText(apiKey);
    }

    /**
     * 判断模型是否已配置。
     *
     * @return true 表示模型名称非空
     */
    public boolean modelConfigured() {
        return StringUtils.hasText(model);
    }

    /**
     * 判断接口地址是否已配置。
     *
     * @return true 表示接口地址非空
     */
    public boolean endpointConfigured() {
        return StringUtils.hasText(apiUrl);
    }

    /**
     * 判断 AI 生成调用所需参数是否完整。
     *
     * @return true 表示 key、模型和接口地址均已配置
     */
    public boolean generationAvailable() {
        return apiKeyConfigured() && modelConfigured() && endpointConfigured();
    }
}
