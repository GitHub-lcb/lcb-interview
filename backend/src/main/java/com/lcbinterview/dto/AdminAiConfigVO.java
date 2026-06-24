package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 管理端 AI 运行时配置展示对象，只暴露脱敏后的密钥和非敏感诊断信息。
 *
 * @param available        AI 生成能力是否可用
 * @param apiKeyConfigured API Key 是否已配置
 * @param maskedApiKey     脱敏后的 API Key
 * @param model            当前生效模型
 * @param apiUrl           当前生效接口地址
 * @param endpointHost     当前生效接口主机名
 * @param interviewEnabled 面试训练 AI 评分是否启用
 * @param message          状态说明
 */
@Schema(description = "管理端 AI 运行时配置")
public record AdminAiConfigVO(
        @Schema(description = "AI 生成功能是否可用") boolean available,
        @Schema(description = "API Key 是否已配置") boolean apiKeyConfigured,
        @Schema(description = "脱敏后的 API Key") String maskedApiKey,
        @Schema(description = "当前模型名称") String model,
        @Schema(description = "当前接口地址") String apiUrl,
        @Schema(description = "接口主机名") String endpointHost,
        @Schema(description = "面试训练 AI 评分是否启用") boolean interviewEnabled,
        @Schema(description = "状态说明") String message
) {
}
