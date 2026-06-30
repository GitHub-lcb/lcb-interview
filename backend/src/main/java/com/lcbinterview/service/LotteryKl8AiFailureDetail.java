package com.lcbinterview.service;

import java.util.Locale;

/**
 * 快乐8 AI 推荐失败诊断信息，仅保留可排查且不泄漏密钥的安全摘要。
 *
 * @param code    失败分类码
 * @param message 面向用户和排查的简短错误
 * @param detail  安全化后的错误细节
 */
public record LotteryKl8AiFailureDetail(String code, String message, String detail) {

    private static final int MAX_DETAIL_LENGTH = 240;

    /**
     * 根据异常链归类 AI 推荐失败原因。
     *
     * @param error AI 调用或解析异常
     * @return 脱敏后的失败诊断
     */
    public static LotteryKl8AiFailureDetail from(Throwable error) {
        String directMessage = sanitize(error == null ? "" : error.getMessage());
        String rootMessage = sanitize(rootMessage(error));
        String combined = (directMessage + " " + rootMessage).toLowerCase(Locale.ROOT);

        if (combined.contains("配置不完整")) {
            return new LotteryKl8AiFailureDetail(
                    "CONFIG_INCOMPLETE",
                    "AI 推荐配置不完整",
                    fallback(rootMessage, "请检查 API Key、模型和接口地址。"));
        }
        if (combined.contains("http")) {
            String message = firstNonBlank(directMessage, rootMessage, "AI 推荐接口返回 HTTP 错误");
            return new LotteryKl8AiFailureDetail("HTTP_STATUS", message, httpDetail(rootMessage));
        }
        if (combined.contains("网络调用失败")
                || combined.contains("timeout")
                || combined.contains("timed out")
                || combined.contains("connect")) {
            return new LotteryKl8AiFailureDetail(
                    "NETWORK",
                    "AI 推荐网络调用失败",
                    fallback(rootMessage, "请检查接口地址、网络连通性或上游超时。"));
        }
        if (combined.contains("中断")) {
            return new LotteryKl8AiFailureDetail(
                    "INTERRUPTED",
                    "AI 推荐调用被中断",
                    fallback(rootMessage, "请求执行过程中被中断。"));
        }
        if (combined.contains("输出不合规")
                || combined.contains("json")
                || combined.contains("groups")
                || combined.contains("号码")) {
            return new LotteryKl8AiFailureDetail(
                    "OUTPUT_INVALID",
                    "AI 推荐输出不符合 JSON 规范",
                    fallback(rootMessage, "模型没有返回 5 组合法号码 JSON。"));
        }
        return new LotteryKl8AiFailureDetail(
                "UNKNOWN",
                "AI 推荐失败",
                fallback(rootMessage, "请查看后端日志定位上游响应。"));
    }

    private static String rootMessage(Throwable error) {
        Throwable current = error;
        Throwable previous = null;
        while (current != null && current != previous) {
            previous = current;
            current = current.getCause();
        }
        return previous == null ? "" : previous.getMessage();
    }

    private static String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String sanitized = value
                .replaceAll("(?i)bearer\\s+[A-Za-z0-9._\\-]+", "Bearer ***")
                .replaceAll("(?i)(api[_-]?key|authorization|token)\\s*[:=]\\s*[^\\s,;]+", "$1=***")
                .replaceAll("(?i)(sk|ak)-[A-Za-z0-9._\\-]+", "$1-***")
                .trim();
        if (sanitized.length() <= MAX_DETAIL_LENGTH) {
            return sanitized;
        }
        return sanitized.substring(0, MAX_DETAIL_LENGTH) + "...";
    }

    private static String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String firstNonBlank(String first, String second, String fallback) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return fallback;
    }

    private static String httpDetail(String rootMessage) {
        String detail = fallback(rootMessage, "上游接口返回非 2xx 状态，请检查 API Key、接口地址、账号额度或服务状态。");
        if (detail.contains("401") || detail.contains("403")) {
            return "上游鉴权失败，请检查 AI API Key 或接口地址。";
        }
        if (detail.contains("429")) {
            return "上游限流或额度不足，请检查账号额度和调用频率。";
        }
        if (detail.contains("500") || detail.contains("502") || detail.contains("503") || detail.contains("504")) {
            return "上游服务异常，请稍后重试或检查服务状态。";
        }
        return detail;
    }
}
