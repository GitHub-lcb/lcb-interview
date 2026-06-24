package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * 管理端 AI 运行时配置更新请求。apiKey 为空时表示保留当前数据库密钥。
 *
 * @param apiKey           新 API Key，留空则保留已有数据库密钥
 * @param model            模型名称，留空则回退到环境变量默认值
 * @param apiUrl           OpenAI 兼容 chat completions 地址，留空则回退到环境变量默认值
 * @param interviewEnabled 是否启用面试训练 AI 评分
 */
@Schema(description = "管理端 AI 运行时配置更新请求")
public record AdminAiConfigUpdateRequest(
        @Schema(description = "新 API Key，留空则保留已有数据库密钥")
        @Size(max = 500, message = "API Key 长度不能超过 500")
        String apiKey,

        @Schema(description = "模型名称")
        @Size(max = 100, message = "模型名称长度不能超过 100")
        String model,

        @Schema(description = "OpenAI 兼容 chat completions 地址")
        @Size(max = 500, message = "接口地址长度不能超过 500")
        String apiUrl,

        @Schema(description = "是否启用面试训练 AI 评分")
        Boolean interviewEnabled
) {
}
