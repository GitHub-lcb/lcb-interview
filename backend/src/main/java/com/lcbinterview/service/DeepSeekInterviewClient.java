package com.lcbinterview.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.InterviewCriterionVO;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DeepSeek/OpenAI 兼容的面试评分客户端。
 * 只读取环境变量中的密钥，调用失败时由上层 Service 自动回退到规则评分。
 */
@Service
public class DeepSeekInterviewClient implements AiInterviewClient {

    private static final int DEFAULT_TIMEOUT_MS = 8000;
    private static final int MAX_ADVICE_SIZE = 4;
    private static final int MAX_FOLLOW_UP_SIZE = 3;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final boolean enabled;
    private final int timeoutMs;

    /**
     * 创建 AI 面试评分客户端。
     *
     * @param objectMapper JSON 序列化组件
     * @param apiKey       模型 API Key，通过环境变量注入
     * @param model        模型名称
     * @param apiUrl       OpenAI 兼容 chat completions 地址
     * @param enabled      是否启用 AI 评分
     * @param timeoutMs    请求超时时间，毫秒
     */
    @Autowired
    public DeepSeekInterviewClient(
            ObjectMapper objectMapper,
            @Value("${ai.deepseek.api-key:}") String apiKey,
            @Value("${ai.deepseek.model:deepseek-v4-flash}") String model,
            @Value("${ai.deepseek.url:https://opencode.ai/zen/go/v1/chat/completions}") String apiUrl,
            @Value("${ai.interview.enabled:true}") boolean enabled,
            @Value("${ai.interview.timeout-ms:" + DEFAULT_TIMEOUT_MS + "}") int timeoutMs) {
        this(
                objectMapper,
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofMillis(Math.max(1000, timeoutMs)))
                        .build(),
                apiKey,
                model,
                apiUrl,
                enabled,
                Math.max(1000, timeoutMs)
        );
    }

    DeepSeekInterviewClient(
            ObjectMapper objectMapper,
            HttpClient httpClient,
            String apiKey,
            String model,
            String apiUrl,
            boolean enabled,
            int timeoutMs) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "" : model.trim();
        this.apiUrl = apiUrl == null ? "" : apiUrl.trim();
        this.enabled = enabled;
        this.timeoutMs = timeoutMs;
    }

    /**
     * 判断当前 AI 客户端是否已经配置完整。
     *
     * @return true 表示可调用外部模型
     */
    @Override
    public boolean isEnabled() {
        return enabled
                && StringUtils.hasText(apiKey)
                && StringUtils.hasText(model)
                && StringUtils.hasText(apiUrl);
    }

    /**
     * 调用 DeepSeek/OpenAI 兼容接口生成结构化面试评分。
     *
     * @param request           面试评分请求
     * @param ruleBasedFallback 规则评分结果，用于模型字段缺失时兜底
     * @return AI 评分结果
     */
    @Override
    public InterviewFeedbackVO evaluate(InterviewEvaluateRequest request, InterviewFeedbackVO ruleBasedFallback) {
        if (!isEnabled()) {
            throw new IllegalStateException("AI 面试评分未启用或未配置密钥");
        }

        try {
            String requestBody = objectMapper.writeValueAsString(buildPayload(request, ruleBasedFallback));
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(apiUrl))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("AI 面试评分接口返回 HTTP " + response.statusCode());
            }
            return parseResponse(response.body(), ruleBasedFallback);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("AI 面试评分请求构造失败", e);
        } catch (IOException e) {
            throw new IllegalStateException("AI 面试评分网络调用失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("AI 面试评分调用被中断", e);
        }
    }

    private Map<String, Object> buildPayload(InterviewEvaluateRequest request, InterviewFeedbackVO fallback) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("temperature", 0.2);
        payload.put("max_tokens", 1200);
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", userPrompt(request, fallback))
        ));
        return payload;
    }

    private String systemPrompt() {
        return """
                你是严谨的中文技术面试官，只输出 JSON 对象，不要 Markdown。
                按候选人回答质量评分，不能因为措辞自信就给高分，也不要编造候选人没有提到的内容。
                JSON 字段必须包含：
                score: 0-100 整数；
                level: strong/pass/needs-work；
                criteria: 四项数组，key 只能是 coverage、structure、specificity、risk，每项含 label、score、summary；
                advice: 1-4 条具体改进建议；
                followUps: 1-3 条可继续追问的问题。
                """;
    }

    private String userPrompt(InterviewEvaluateRequest request, InterviewFeedbackVO fallback) {
        return """
                请根据以下题目上下文和候选人回答生成面试评分。

                目标岗位：%s
                题目：%s
                分类：%s
                难度：%s
                标签：%s

                候选人回答：
                %s

                规则评分参考：总分 %d，等级 %s。参考只能用于校准，不要机械照抄。
                """.formatted(
                nullToEmpty(request.targetRole()),
                nullToEmpty(request.questionTitle()),
                nullToEmpty(request.categoryName()),
                nullToEmpty(request.difficulty()),
                String.join("、", request.tags() == null ? List.of() : request.tags()),
                nullToEmpty(request.answer()),
                fallback.score(),
                fallback.level()
        );
    }

    private InterviewFeedbackVO parseResponse(String responseBody, InterviewFeedbackVO fallback) {
        try {
            JsonNode response = objectMapper.readTree(responseBody);
            String content = response.path("choices").path(0).path("message").path("content").asText("");
            JsonNode feedback = objectMapper.readTree(extractJsonObject(content));
            int score = clampScore(feedback.path("score").asInt(fallback.score()));
            String level = normalizeLevel(feedback.path("level").asText(), score);
            List<InterviewCriterionVO> criteria = parseCriteria(feedback.path("criteria"), fallback.criteria());
            List<String> advice = parseStringList(feedback.path("advice"), fallback.advice(), MAX_ADVICE_SIZE);
            List<String> followUps = parseStringList(feedback.path("followUps"), fallback.followUps(), MAX_FOLLOW_UP_SIZE);
            return new InterviewFeedbackVO(score, level, criteria, advice, followUps, "AI");
        } catch (Exception e) {
            throw new IllegalStateException("AI 面试评分响应解析失败", e);
        }
    }

    private List<InterviewCriterionVO> parseCriteria(JsonNode criteriaNode, List<InterviewCriterionVO> fallback) {
        if (!criteriaNode.isArray()) {
            return fallback;
        }
        List<InterviewCriterionVO> criteria = new ArrayList<>();
        for (JsonNode item : criteriaNode) {
            String key = item.path("key").asText("");
            if (!List.of("coverage", "structure", "specificity", "risk").contains(key)) {
                continue;
            }
            criteria.add(new InterviewCriterionVO(
                    key,
                    label(key, item.path("label").asText("")),
                    clampScore(item.path("score").asInt(0)),
                    item.path("summary").asText("")
            ));
        }
        return criteria.size() == 4 ? criteria : fallback;
    }

    private List<String> parseStringList(JsonNode arrayNode, List<String> fallback, int limit) {
        if (!arrayNode.isArray()) {
            return fallback;
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            String value = item.asText("").trim();
            if (!value.isBlank()) {
                values.add(value);
            }
            if (values.size() >= limit) {
                break;
            }
        }
        return values.isEmpty() ? fallback : values;
    }

    private String extractJsonObject(String content) {
        String cleanContent = content == null ? "" : content.trim()
                .replaceAll("(?s)^```json\\s*", "")
                .replaceAll("(?s)^```\\s*", "")
                .replaceAll("(?s)\\s*```$", "")
                .trim();
        int start = cleanContent.indexOf('{');
        int end = cleanContent.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("AI 响应中没有 JSON 对象");
        }
        return cleanContent.substring(start, end + 1);
    }

    private String normalizeLevel(String value, int score) {
        return switch (value) {
            case "strong", "pass", "needs-work" -> value;
            default -> score >= 80 ? "strong" : score >= 60 ? "pass" : "needs-work";
        };
    }

    private String label(String key, String fallbackLabel) {
        if (StringUtils.hasText(fallbackLabel)) {
            return fallbackLabel;
        }
        return switch (key) {
            case "coverage" -> "知识覆盖";
            case "structure" -> "表达结构";
            case "specificity" -> "场景细节";
            case "risk" -> "边界风险";
            default -> key;
        };
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private int clampScore(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
