package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 管理端 AI 服务配置状态，只暴露可用性和非敏感诊断信息。
 */
@Schema(description = "管理端 AI 服务配置状态")
public record AdminAiConfigStatusVO(
        @Schema(description = "远程 AI 生成功能是否可用") boolean available,
        @Schema(description = "API Key 是否已配置") boolean apiKeyConfigured,
        @Schema(description = "当前模型名称") String model,
        @Schema(description = "接口主机名") String endpointHost,
        @Schema(description = "状态说明") String message
) {
}
