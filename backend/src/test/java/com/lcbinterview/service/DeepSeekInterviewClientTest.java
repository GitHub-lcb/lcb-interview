package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.InterviewCriterionVO;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * DeepSeek 面试评分客户端测试，验证 OpenAI 兼容响应解析、鉴权头和失败处理。
 */
class DeepSeekInterviewClientTest {

    @Test
    void springContextCreatesDeepSeekInterviewClientBean() {
        AiRuntimeConfigService aiRuntimeConfigService = mock(AiRuntimeConfigService.class);
        new ApplicationContextRunner()
                .withBean(ObjectMapper.class)
                .withBean(AiRuntimeConfigService.class, () -> aiRuntimeConfigService)
                .withBean(DeepSeekInterviewClient.class)
                .withPropertyValues(
                        "ai.interview.timeout-ms=5000"
                )
                .run(context -> assertThat(context).hasSingleBean(DeepSeekInterviewClient.class));
    }

    @Test
    void evaluateParsesOpenAiCompatibleJsonResponse() throws IOException {
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = startServer(200, exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            return """
                    {
                      "choices": [
                        {
                          "message": {
                            "content": "```json\\n{\\n  \\"score\\": 87,\\n  \\"level\\": \\"strong\\",\\n  \\"criteria\\": [\\n    {\\"key\\": \\"coverage\\", \\"label\\": \\"知识覆盖\\", \\"score\\": 88, \\"summary\\": \\"覆盖核心点\\"},\\n    {\\"key\\": \\"structure\\", \\"label\\": \\"表达结构\\", \\"score\\": 85, \\"summary\\": \\"结构清晰\\"},\\n    {\\"key\\": \\"specificity\\", \\"label\\": \\"场景细节\\", \\"score\\": 84, \\"summary\\": \\"有场景\\"},\\n    {\\"key\\": \\"risk\\", \\"label\\": \\"边界风险\\", \\"score\\": 80, \\"summary\\": \\"边界明确\\"}\\n  ],\\n  \\"advice\\": [\\"补充树化阈值\\"],\\n  \\"followUps\\": [\\"为什么容量不足时优先扩容？\\"]\\n}\\n```"
                          }
                        }
                      ]
                    }
                    """;
        });
        try {
            DeepSeekInterviewClient client = client(server, "test-key", true);

            InterviewFeedbackVO feedback = client.evaluate(request(), fallback());

            assertThat(authorization.get()).isEqualTo("Bearer test-key");
            assertThat(requestBody.get()).contains("\"model\":\"test-model\"");
            assertThat(feedback.score()).isEqualTo(87);
            assertThat(feedback.level()).isEqualTo("strong");
            assertThat(feedback.source()).isEqualTo("AI");
            assertThat(feedback.criteria()).hasSize(4);
            assertThat(feedback.advice()).containsExactly("补充树化阈值");
            assertThat(feedback.followUps()).containsExactly("为什么容量不足时优先扩容？");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void isDisabledWhenApiKeyIsBlank() throws IOException {
        HttpServer server = startServer(200, exchange -> "{}");
        try {
            DeepSeekInterviewClient client = client(server, " ", true);

            assertThat(client.isEnabled()).isFalse();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void evaluateThrowsWithoutResponseBodyOnHttpFailure() throws IOException {
        HttpServer server = startServer(500, exchange -> "{\"error\":\"server failed\"}");
        try {
            DeepSeekInterviewClient client = client(server, "test-key", true);

            assertThatThrownBy(() -> client.evaluate(request(), fallback()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("HTTP 500")
                    .hasMessageNotContaining("server failed");
        } finally {
            server.stop(0);
        }
    }

    private DeepSeekInterviewClient client(HttpServer server, String apiKey, boolean enabled) {
        AiRuntimeConfigService aiRuntimeConfigService = mock(AiRuntimeConfigService.class);
        when(aiRuntimeConfigService.current()).thenReturn(new AiRuntimeConfig(
                apiKey,
                "test-model",
                "http://localhost:" + server.getAddress().getPort() + "/v1/chat/completions",
                enabled));
        return new DeepSeekInterviewClient(
                new ObjectMapper(),
                HttpClient.newHttpClient(),
                aiRuntimeConfigService,
                5000
        );
    }

    private HttpServer startServer(int status, Responder responder) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            String response = responder.respond(exchange);
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return server;
    }

    private InterviewEvaluateRequest request() {
        return new InterviewEvaluateRequest(
                "HashMap 为什么引入红黑树？",
                "Java 集合",
                List.of("HashMap", "红黑树"),
                "HARD",
                "Java 后端",
                "首先说明链表退化，其次说明树化阈值和扩容边界。"
        );
    }

    private InterviewFeedbackVO fallback() {
        return new InterviewFeedbackVO(
                70,
                "pass",
                List.of(
                        new InterviewCriterionVO("coverage", "知识覆盖", 70, "覆盖一般"),
                        new InterviewCriterionVO("structure", "表达结构", 70, "结构一般"),
                        new InterviewCriterionVO("specificity", "场景细节", 70, "细节一般"),
                        new InterviewCriterionVO("risk", "边界风险", 70, "边界一般")
                ),
                List.of("补充细节"),
                List.of("继续追问"),
                "RULE_BASED"
        );
    }

    private interface Responder {
        String respond(com.sun.net.httpserver.HttpExchange exchange) throws IOException;
    }
}
