package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * DeepSeek API HTTP 客户端，封装流式和非流式调用逻辑。
 * <p>
 * 从 {@link AiQuestionService} 中提取，职责单一化：
 * <ul>
 *   <li>构建请求体（model、messages、temperature、max_tokens）</li>
 *   <li>发送 HTTP 请求并解析 SSE 流式响应或 JSON 非流式响应</li>
 *   <li>安全处理错误流，避免 {@code getErrorStream()} 返回 null 时 NPE</li>
 * </ul>
 * @author chongan
 */
@Slf4j
@Component
public class AiHttpClient {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.deepseek.max-tokens:65536}")
    private int maxTokens;

    /**
     * 流式调用结果，包含完整内容、推理文本和统计信息。
     *
     * @param content         完整回复内容
     * @param reasoning       推理过程文本（仅 FULL 模式捕获）
     * @param reasoningLength 推理内容总长度
     * @param chunkCount      接收到的 SSE chunk 总数
     */
    public record StreamResult(String content, String reasoning, int reasoningLength, int chunkCount) {
    }

    /**
     * SSE 流式推送模式。
     *
     * @param stopOnClosed       连接关闭时是否抛异常中断
     * @param captureReasoning  是否捕获推理内容到返回值
     */
    public enum StreamPushMode {
        FULL(true, true),
        HEARTBEAT_ONLY(false, false),
        SILENT(false, false);

        private final boolean stopOnClosed;
        private final boolean captureReasoning;

        StreamPushMode(boolean stopOnClosed, boolean captureReasoning) {
            this.stopOnClosed = stopOnClosed;
            this.captureReasoning = captureReasoning;
        }

        /**
         * @return 连接关闭时是否抛异常
         */
        public boolean stopOnClosed() {
            return stopOnClosed;
        }

        /**
         * @return 是否捕获推理内容
         */
        public boolean captureReasoning() {
            return captureReasoning;
        }
    }

    /**
     * 非流式调用 DeepSeek，返回完整 JSON 响应。
     *
     * @param prompt        用户提示词
     * @param runtimeConfig 运行时配置
     * @return 完整 JSON 响应字符串
     */
    public String callSync(String prompt, AiRuntimeConfig runtimeConfig) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", runtimeConfig.model());
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content",
                        "你是一位资深技术面试官，擅长出高质量面试题并给出详细解答。"),
                Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("max_tokens", maxTokens);

        log.info("非流式请求: model={}, prompt长度={}字符, maxTokens={}", runtimeConfig.model(), prompt.length(), maxTokens);
        long t = System.currentTimeMillis();

        try {
            String json = objectMapper.writeValueAsString(requestBody);

            HttpURLConnection conn = (HttpURLConnection) URI.create(runtimeConfig.apiUrl()).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + runtimeConfig.apiKey());
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(600000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            long apiTime = System.currentTimeMillis() - t;
            log.info("DeepSeek 响应: status={}, 耗时={}ms", status, apiTime);

            if (status == 200) {
                String response = new String(
                        conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                log.info("响应体大小: {} 字符, 总耗时={}ms", response.length(), System.currentTimeMillis() - t);
                return response;
            }

            String errorBody = readErrorStreamSafely(conn);
            log.error("DeepSeek API 错误: status={}, body={}", status, truncate(errorBody, 500));
            throw new RuntimeException("DeepSeek API 错误: " + status + " " + errorBody);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用 DeepSeek API 异常: {}", e.getMessage());
            throw new RuntimeException("调用 DeepSeek API 失败: " + e.getMessage(), e);
        }
    }

    /**
     * 流式调用 DeepSeek，将 thinking/content 实时推送到 SSE 会话。
     *
     * @param prompt        用户提示词
     * @param runtimeConfig 运行时配置
     * @param session       SSE 会话，SILENT 模式可为 null
     * @param pushMode      推送模式
     * @return 流式调用结果
     */
    public StreamResult callStream(String prompt, AiRuntimeConfig runtimeConfig,
                                   SseStreamSession session, StreamPushMode pushMode) {
        if (pushMode.stopOnClosed() && (session == null || !session.isOpen())) {
            throw new AiQuestionService.SseStreamClosedException("SSE 连接已关闭");
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", runtimeConfig.model());
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content",
                        "你是一位资深技术面试官，擅长出高质量面试题并给出详细解答。"),
                Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("max_tokens", maxTokens);
        requestBody.put("stream", true);

        HttpURLConnection conn = null;
        try {
            String json = objectMapper.writeValueAsString(requestBody);

            conn = (HttpURLConnection) URI.create(runtimeConfig.apiUrl()).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + runtimeConfig.apiKey());
            conn.setRequestProperty("Accept", "text/event-stream");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(600000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            if (status != 200) {
                String errorBody = readErrorStreamSafely(conn);
                log.error("DeepSeek 流式 API 错误: status={}, body={}", status, truncate(errorBody, 500));
                if (pushMode != StreamPushMode.SILENT && session != null) {
                    session.sendEvent("error", "API 错误: " + status);
                }
                throw new RuntimeException("DeepSeek API 错误: " + status);
            }

            StringBuilder fullContent = new StringBuilder();
            StringBuilder fullReasoning = new StringBuilder();
            int reasoningLength = 0;
            int chunkCount = 0;

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (pushMode.stopOnClosed() && !session.isOpen()) {
                        throw new AiQuestionService.SseStreamClosedException("SSE 连接已关闭");
                    }
                    if (line.isEmpty()) {
                        continue;
                    }
                    if (!line.startsWith("data: ")) {
                        continue;
                    }

                    String data = line.substring(6).trim();
                    if ("[DONE]".equals(data)) {
                        break;
                    }

                    try {
                        JsonNode chunk = objectMapper.readTree(data);
                        JsonNode choice = chunk.path("choices").get(0);
                        if (choice == null || choice.isNull()) {
                            continue;
                        }
                        chunkCount++;

                        JsonNode delta = choice.path("delta");
                        String reasoning = delta.path("reasoning_content").asText(null);
                        if (reasoning != null && !reasoning.isEmpty()) {
                            reasoningLength += reasoning.length();
                            if (pushMode.captureReasoning()) {
                                fullReasoning.append(reasoning);
                            }
                            pushStreamDelta(session, pushMode, "thinking", reasoning, chunkCount);
                        }

                        String content = delta.path("content").asText(null);
                        if (content != null && !content.isEmpty()) {
                            fullContent.append(content);
                            pushStreamDelta(session, pushMode, "content", content, chunkCount);
                        }
                    } catch (AiQuestionService.SseStreamClosedException e) {
                        throw e;
                    } catch (Exception e) {
                        log.warn("解析 chunk 失败: {} — {}", truncate(line, 100), e.getMessage());
                    }
                }
            }

            return new StreamResult(fullContent.toString().trim(), fullReasoning.toString(), reasoningLength, chunkCount);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("DeepSeek 流式调用异常", e);
            throw new RuntimeException("流式调用失败: " + e.getMessage(), e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    /**
     * 根据推送模式将流式增量推送到 SSE 会话。
     *
     * @param session    SSE 会话
     * @param pushMode   推送模式
     * @param name       事件名
     * @param data       事件数据
     * @param chunkCount 当前 chunk 计数
     */
    private void pushStreamDelta(SseStreamSession session, StreamPushMode pushMode,
                                 String name, String data, int chunkCount) {
        if (pushMode == StreamPushMode.SILENT) {
            return;
        }
        if (pushMode == StreamPushMode.FULL) {
            session.sendEvent(name, data);
            return;
        }
        // HEARTBEAT_ONLY：每 120 个 chunk 发送一次心跳
        if (session != null && chunkCount % 120 == 0) {
            session.sendEvent("info", "AI 正在生成，已接收 " + chunkCount + " 个片段");
        }
    }

    /**
     * 安全读取 HttpURLConnection 错误流，避免 getErrorStream() 返回 null 时 NPE。
     *
     * @param conn HTTP 连接
     * @return 错误响应体，流不可用时返回空字符串
     */
    private String readErrorStreamSafely(HttpURLConnection conn) {
        try {
            var errorStream = conn.getErrorStream();
            if (errorStream == null) {
                return "";
            }
            return new String(errorStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("读取错误流失败: {}", e.getMessage());
            return "";
        }
    }

    private String truncate(String s, int max) {
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
