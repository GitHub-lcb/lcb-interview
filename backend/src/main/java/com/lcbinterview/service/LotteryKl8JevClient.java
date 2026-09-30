package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Jev（TypeSafe System One）决策模型客户端。
 *
 * 与 {@link LotteryKl8AiRecommendationService} 走的不是同一条链路：
 * 后者是 OpenAI 兼容的生成式补全，需要提示词工程与 JSON 解析容错；
 * Jev 只接受类型化问题、只返回类型化答案，因此这里不做任何文本解析，
 * 但必须自己承担「答案合法 ≠ 答案正确」的责任，调用方需要用校准结果判断可用性。
 *
 * 使用 JDK 内置 HttpClient，不引入任何新依赖。
 */
@Service
public class LotteryKl8JevClient {

    private static final Logger log = LoggerFactory.getLogger(LotteryKl8JevClient.class);

    /** 单次请求最多尝试次数：429（限流）与 529（过载）属于可自动恢复错误，允许重试 */
    private static final int MAX_ATTEMPTS = 3;
    /** 重试基础退避时间（毫秒），按指数增长，避免限流时叠加压力 */
    private static final long RETRY_BASE_BACKOFF_MS = 400L;
    /** Choice 选项上限由 Jev 官方限定为 255 */
    private static final int MAX_CHOICE_OPTIONS = 255;
    /** 错误响应体截断长度，避免把大段响应打进日志 */
    private static final int ERROR_BODY_SNIPPET_LIMIT = 300;

    private final ObjectMapper objectMapper;
    private final JevRuntimeConfigService configService;
    private final HttpClient httpClient;

    /**
     * 创建 Jev 客户端。
     *
     * @param objectMapper  JSON 组件
     * @param configService Jev 配置服务
     */
    @Autowired
    public LotteryKl8JevClient(ObjectMapper objectMapper, JevRuntimeConfigService configService) {
        this(objectMapper, configService,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
    }

    /**
     * 包内可见构造器，供单元测试注入桩 HttpClient。
     *
     * @param objectMapper  JSON 组件
     * @param configService Jev 配置服务
     * @param httpClient    HTTP 客户端
     */
    LotteryKl8JevClient(ObjectMapper objectMapper, JevRuntimeConfigService configService, HttpClient httpClient) {
        this.objectMapper = objectMapper;
        this.configService = configService;
        this.httpClient = httpClient;
    }

    /**
     * 对给定状态执行一组类型化问题。
     *
     * @param state     共享状态，可为字符串、Map 或 List，会原样序列化进 state 字段
     * @param questions 问题列表，id 必须唯一且非空
     * @return 一次评估结果
     * @throws IllegalStateException 配置不完整、网络失败或服务端返回非 2xx
     */
    public JevEvaluation evaluate(Object state, List<JevQuestion> questions) {
        JevRuntimeConfig config = configService.current();
        if (!config.callable()) {
            throw new IllegalStateException("Jev 配置不可用：" + configService.publicStatus().message());
        }
        validateQuestions(questions);

        String body = serializeRequest(config.model(), state, questions);
        long startedAt = System.nanoTime();
        HttpResponse<String> response = sendWithRetry(config, body);
        long latencyMs = (System.nanoTime() - startedAt) / 1_000_000L;

        JevEvaluation evaluation = parseResponse(response.body(), latencyMs);
        log.info("Jev 评估完成：问题数={}，返回答案数={}，模型={}，耗时={}ms，输入token={}",
                questions.size(), evaluation.answers().size(), evaluation.model(), latencyMs, evaluation.inputTokens());
        return evaluation;
    }

    /**
     * 校验问题列表的合法性。
     *
     * @param questions 问题列表
     */
    private void validateQuestions(List<JevQuestion> questions) {
        if (questions == null || questions.isEmpty()) {
            throw new IllegalArgumentException("Jev 请求至少需要一个类型化问题");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (JevQuestion question : questions) {
            if (question.id() == null || question.id().isBlank()) {
                throw new IllegalArgumentException("Jev 问题 id 不能为空");
            }
            if (!seen.add(question.id())) {
                throw new IllegalArgumentException("Jev 问题 id 重复：" + question.id());
            }
            if (question.instructions() == null || question.instructions().isBlank()) {
                throw new IllegalArgumentException("Jev 问题指令不能为空：" + question.id());
            }
            if (question.type() == null) {
                throw new IllegalArgumentException("Jev 问题类型不能为空：" + question.id());
            }
            if (JevQuestion.TYPE_CHOICE.equals(question.type())
                    && question.criteria().size() > MAX_CHOICE_OPTIONS) {
                throw new IllegalArgumentException(
                        "Choice 选项数量超过 Jev 上限 %d：%d".formatted(MAX_CHOICE_OPTIONS, question.criteria().size()));
            }
        }
    }

    /**
     * 序列化请求体。
     * choice 的 criteria 是选项映射，score 的 criteria 是按序档位列表，
     * noul 的 criteria 是可选的 true/false 边界说明，仅在调用方提供时才提交。
     *
     * 包内可见是为了让单元测试直接覆盖请求体构造，不必启动 HTTP 服务。
     *
     * @param model     模型标识
     * @param state     共享状态
     * @param questions 问题列表
     * @return JSON 请求体
     */
    String serializeRequest(String model, Object state, List<JevQuestion> questions) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("state", state);
        Map<String, Object> questionNodes = new LinkedHashMap<>();
        for (JevQuestion question : questions) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("type", question.type());
            node.put("instructions", question.instructions());
            if (JevQuestion.TYPE_CHOICE.equals(question.type())) {
                node.put("criteria", question.criteria());
            } else if (JevQuestion.TYPE_SCORE.equals(question.type())) {
                node.put("criteria", question.levels());
            } else if (!question.criteria().isEmpty()) {
                node.put("criteria", question.criteria());
            }
            questionNodes.put(question.id(), node);
        }
        payload.put("questions", questionNodes);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Jev 请求体序列化失败", e);
        }
    }

    /**
     * 发送请求并按需重试。
     * 仅在 429（限流）和 529（过载）时退避重试，其余错误立即抛出，避免把参数错误也当成瞬时故障反复重试。
     *
     * @param config 生效配置
     * @param body   请求体
     * @return HTTP 响应
     */
    private HttpResponse<String> sendWithRetry(JevRuntimeConfig config, String body) {
        IllegalStateException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(config.apiUrl()))
                        .timeout(Duration.ofMillis(config.timeoutMs()))
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")
                        .header("Authorization", "Bearer " + config.apiKey())
                        .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                        .build();
                HttpResponse<String> response = httpClient.send(request,
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int status = response.statusCode();
                if (status >= 200 && status < 300) {
                    return response;
                }
                if (isRetryableStatus(status) && attempt < MAX_ATTEMPTS) {
                    long backoff = RETRY_BASE_BACKOFF_MS * (1L << (attempt - 1));
                    log.warn("Jev 返回 HTTP {}，第 {} 次尝试失败，{}ms 后重试", status, attempt, backoff);
                    lastFailure = new IllegalStateException("Jev 接口返回 HTTP " + status + describeStatus(status));
                    sleepQuietly(backoff);
                    continue;
                }
                // 携带响应体片段：422 会明确指出是哪个字段不合法，401 便于区分密钥错误与端点错误
                throw new IllegalStateException("Jev 接口返回 HTTP " + status + describeStatus(status)
                        + "，响应片段：" + snippet(response.body()));
            } catch (IOException e) {
                lastFailure = new IllegalStateException("Jev 网络调用失败", e);
                if (attempt < MAX_ATTEMPTS) {
                    long backoff = RETRY_BASE_BACKOFF_MS * (1L << (attempt - 1));
                    log.warn("Jev 网络调用失败，第 {} 次尝试，{}ms 后重试：{}", attempt, backoff, e.getMessage());
                    sleepQuietly(backoff);
                    continue;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Jev 调用被中断", e);
            }
        }
        throw lastFailure == null ? new IllegalStateException("Jev 调用失败") : lastFailure;
    }

    /**
     * 判断状态码是否属于可自动恢复的错误。
     *
     * @param status HTTP 状态码
     * @return true 表示限流或过载
     */
    private boolean isRetryableStatus(int status) {
        return status == 429 || status == 529 || status >= 500;
    }

    /**
     * 为常见状态码补充中文解释，便于部署期定位问题。
     *
     * @param status HTTP 状态码
     * @return 中文说明
     */
    private String describeStatus(int status) {
        return switch (status) {
            case 401 -> "（密钥缺失或错误，检查 TYPESAFE_API_KEY）";
            case 422 -> "（请求体校验失败，检查问题类型与 criteria 结构）";
            case 429 -> "（触发限流，请降低调用频率）";
            case 529 -> "（服务端过载，稍后重试）";
            default -> "";
        };
    }

    /**
     * 解析响应体为评估结果。
     * 答案字段按官方文档建模，同时对可选字段做退避，避免上游省略字段时整体失败。
     * 包内可见是为了让单元测试直接覆盖解析分支，不必启动 HTTP 服务。
     *
     * @param body      响应体
     * @param latencyMs 本地观测耗时
     * @return 评估结果
     */
    JevEvaluation parseResponse(String body, long latencyMs) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode answersNode = root.path("answers");
            Map<String, JevAnswer> answers = new LinkedHashMap<>();
            if (answersNode.isObject()) {
                answersNode.fields().forEachRemaining(entry -> {
                    JevAnswer answer = parseAnswer(entry.getKey(), entry.getValue());
                    if (answer != null) {
                        answers.put(entry.getKey(), answer);
                    }
                });
            }
            String model = root.path("model").asText("");
            JsonNode usage = root.path("usage");
            long inputTokens = usage.path("input_tokens").asLong(0);
            long outputTokens = usage.path("output_tokens").asLong(0);
            return new JevEvaluation(answers, model, inputTokens, outputTokens, latencyMs);
        } catch (Exception e) {
            throw new IllegalStateException("Jev 响应解析失败", e);
        }
    }

    /**
     * 解析单个答案。
     * type 字段缺失时按「存在哪个专有字段」反推，兼容服务端精简响应。
     *
     * @param id     问题标识
     * @param node   答案节点
     * @return 答案对象，节点不是对象时返回 null
     */
    private JevAnswer parseAnswer(String id, JsonNode node) {
        if (!node.isObject()) {
            return null;
        }
        Map<String, Double> probabilities = new LinkedHashMap<>();
        JsonNode probabilitiesNode = node.path("probabilities");
        if (probabilitiesNode.isObject()) {
            probabilitiesNode.fields().forEachRemaining(entry ->
                    probabilities.put(entry.getKey(), entry.getValue().asDouble(0.0)));
        }
        // Score 会把请求提交的档位文字原样回传，用于校验档位没被打乱
        Map<String, String> legend = new LinkedHashMap<>();
        JsonNode legendNode = node.path("legend");
        if (legendNode.isObject()) {
            legendNode.fields().forEachRemaining(entry ->
                    legend.put(entry.getKey(), entry.getValue().asText("")));
        }
        // 刻意用显式分支而不是三元表达式：三元表达式在 double 与 null 混合时会发生拆箱，
        // 字段缺失时直接抛 NPE，而这里恰恰要求缺失能安全退避
        Double probability = null;
        if (node.hasNonNull("noul")) {
            probability = node.path("noul").asDouble();
        } else if (node.hasNonNull("probability")) {
            probability = node.path("probability").asDouble();
        }
        String choice = node.hasNonNull("choice") ? node.path("choice").asText() : null;
        Double score = null;
        if (node.hasNonNull("score")) {
            score = node.path("score").asDouble();
        }
        Double confidence = null;
        if (node.hasNonNull("confidence")) {
            confidence = node.path("confidence").asDouble();
        }

        String type = node.path("type").asText("");
        if (type.isBlank()) {
            if (probability != null) {
                type = JevQuestion.TYPE_NOUL;
            } else if (choice != null) {
                type = JevQuestion.TYPE_CHOICE;
            } else if (score != null || !legend.isEmpty()) {
                // legend 只出现在 Score 答案上，可作为类型反推的最后一道依据
                type = JevQuestion.TYPE_SCORE;
            }
        }
        // 保留 JSON 中的原始顺序：Map.copyOf 的迭代顺序未定义，
        // 而档位/选项的概率分布顺序是排查「档位错位」最直观的依据，不能被打乱。
        Map<String, Double> orderedProbabilities = Collections.unmodifiableMap(new LinkedHashMap<>(probabilities));
        return new JevAnswer(id, type, probability, choice, score,
                orderedProbabilities, confidence, JevAnswer.copyLegend(legend));
    }

    /**
     * 截断响应体用于错误信息。
     *
     * @param body 响应体
     * @return 截断后的片段
     */
    private String snippet(String body) {
        if (body == null) {
            return "";
        }
        String trimmed = body.trim();
        return trimmed.length() <= ERROR_BODY_SNIPPET_LIMIT
                ? trimmed
                : trimmed.substring(0, ERROR_BODY_SNIPPET_LIMIT) + "...";
    }

    /**
     * 退避等待，被中断时恢复中断标记并直接抛出，避免吞掉取消信号。
     *
     * @param millis 等待毫秒数
     */
    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Jev 重试等待被中断", e);
        }
    }
}
