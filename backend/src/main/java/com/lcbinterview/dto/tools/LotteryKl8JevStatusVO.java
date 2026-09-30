package com.lcbinterview.dto.tools;

/**
 * Jev 决策模型配置状态展示对象。
 *
 * 只暴露脱敏后的密钥与主机名，避免第三方密钥通过接口泄露。
 *
 * @param enabled          是否启用 Jev 决策层
 * @param available        是否具备调用条件（开关 + 密钥 + 模型 + 地址齐全）
 * @param scoringAllowed   是否允许 Jev 概率参与推荐排序
 * @param apiKeyConfigured 密钥是否已配置
 * @param maskedApiKey     脱敏后的密钥
 * @param model            模型标识
 * @param endpointHost     端点主机名
 * @param timeoutMs        单次调用超时（毫秒）
 * @param promptLocale     送模型的提示词语言（zh / en）
 * @param message          中文状态说明
 */
public record LotteryKl8JevStatusVO(
        boolean enabled,
        boolean available,
        boolean scoringAllowed,
        boolean apiKeyConfigured,
        String maskedApiKey,
        String model,
        String endpointHost,
        long timeoutMs,
        String promptLocale,
        String message
) {
}
