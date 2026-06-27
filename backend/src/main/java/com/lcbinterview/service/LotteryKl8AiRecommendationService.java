package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 快乐8 AI 推荐客户端，复用现有 OpenAI 兼容 AI 配置。
 */
@Service
public class LotteryKl8AiRecommendationService {

    private final ObjectMapper objectMapper;
    private final AiRuntimeConfigService aiRuntimeConfigService;
    private final HttpClient httpClient;

    /**
     * 创建快乐8 AI 推荐客户端。
     *
     * @param objectMapper           JSON 组件
     * @param aiRuntimeConfigService AI 运行时配置服务
     */
    public LotteryKl8AiRecommendationService(ObjectMapper objectMapper, AiRuntimeConfigService aiRuntimeConfigService) {
        this(objectMapper, aiRuntimeConfigService, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
    }

    LotteryKl8AiRecommendationService(
            ObjectMapper objectMapper,
            AiRuntimeConfigService aiRuntimeConfigService,
            HttpClient httpClient) {
        this.objectMapper = objectMapper;
        this.aiRuntimeConfigService = aiRuntimeConfigService;
        this.httpClient = httpClient;
    }

    /**
     * 调用 AI 生成快乐8选5推荐 JSON。
     *
     * @param report 历史特征报告
     * @return AI 输出文本
     */
    public String recommend(LotteryKl8FeatureReport report) {
        AiRuntimeConfig config = aiRuntimeConfigService.current();
        if (!StringUtils.hasText(config.apiKey()) || !StringUtils.hasText(config.model()) || !StringUtils.hasText(config.apiUrl())) {
            throw new IllegalStateException("AI 推荐配置不完整");
        }
        try {
            String body = objectMapper.writeValueAsString(buildPayload(report, config.model()));
            HttpRequest request = HttpRequest.newBuilder(URI.create(config.apiUrl()))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + config.apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("AI 推荐接口返回 HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            return root.path("choices").path(0).path("message").path("content").asText("");
        } catch (IOException e) {
            throw new IllegalStateException("AI 推荐网络调用失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("AI 推荐调用被中断", e);
        }
    }

    private Map<String, Object> buildPayload(LotteryKl8FeatureReport report, String model) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("temperature", 0.35);
        payload.put("max_tokens", 1600);
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", userPrompt(report))
        ));
        return payload;
    }

    private String systemPrompt() {
        return """
                你是彩票历史数据统计分析助手。彩票结果具有随机性，你不能承诺命中，也不能给投注金额建议。
                只输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。
                JSON 结构必须是：{"groups":[{"numbers":[1,2,3,4,5],"reason":"20到80字中文理由"}]}。
                必须恰好 5 组，每组恰好 5 个整数，号码范围 1-80，组内不重复。
                """;
    }

    private String userPrompt(LotteryKl8FeatureReport report) {
        return """
                请根据以下快乐8历史特征，为下一期选5玩法生成 5 组娱乐统计参考号码。

                %s
                热号：%s
                冷号：%s
                遗漏期数最高：%s
                区间分布：%s

                要求：每组冷热均衡，尽量覆盖不同区间；理由必须说明统计依据，并再次避免中奖承诺。
                """.formatted(
                report.summary(),
                report.hotNumbers(),
                report.coldNumbers(),
                report.missingNumbers().entrySet().stream()
                        .sorted((left, right) -> right.getValue().compareTo(left.getValue()))
                        .limit(12)
                        .toList(),
                report.rangeCounts());
    }
}
