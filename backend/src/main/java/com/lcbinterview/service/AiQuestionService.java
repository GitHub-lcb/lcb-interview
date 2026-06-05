package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

/**
 * AI 题目生成服务。调用 DeepSeek API 流式生成/补全面试题目。
 * 所有操作通过 SSE 实时推送进度和 AI 思考过程。
 * @author chongan
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiQuestionService {

    private final QuestionMapper questionMapper;
    private final CategoryMapper categoryMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    @Value("${ai.deepseek.api-key}")
    private String apiKey;

    @Value("${ai.deepseek.model:deepseek-v4-flash}")
    private String model;

    @Value("${ai.deepseek.url:https://opencode.ai/zen/go/v1/chat/completions}")
    private String apiUrl;

    @Value("${ai.deepseek.max-tokens:65536}")
    private int maxTokens;

    // ==================== 同步方法（供 BatchGenerationRunner 使用） ====================

    /**
     * 同步生成题目（供 BatchGenerationRunner 调用）。
     */
    public List<Long> generateSync(GenerationRequest req, Long categoryId) {
        log.info("同步生成: category='{}', categoryId={}, count={}, topic='{}', 模型={}, maxTokens={}",
                req.category(), categoryId, req.count(), req.topic(), model, maxTokens);

        String prompt = buildPrompt(req);
        log.info("调用 DeepSeek, prompt长度={}字符", prompt.length());
        long t = System.currentTimeMillis();

        String responseJson = callDeepSeek(prompt);
        logResponseUsage(responseJson);
        List<Question> questions = parseQuestions(responseJson);

        List<Long> ids = new ArrayList<>();
        int toSave = Math.min(questions.size(), req.count());
        for (int i = 0; i < toSave; i++) {
            Question q = questions.get(i);
            q.setStatus("PUBLISHED");
            q.setSource("AI_GENERATED");
            q.setCategoryId(categoryId);
            questionMapper.insert(q);
            ids.add(q.getId());
            log.info("同步保存 [{}/{}]: id={}, title='{}'", i + 1, toSave, q.getId(), truncate(q.getTitle(), 50));
        }

        long elapsed = System.currentTimeMillis() - t;
        log.info("同步生成完成: category='{}', 成功={}道, 耗时={}ms", req.category(), ids.size(), elapsed);
        return ids;
    }

    // ==================== SSE 流式方法 ====================

    /**
     * 流式生成题目 — 每道题独立发送一次请求，逐题展示进度和 AI 思考过程。
     */
    public void streamGenerate(GenerationRequest req, SseEmitter emitter) {
        log.info("流式生成启动: category='{}', difficulty={}, topic='{}', count={}, 模型={}, maxTokens={}",
                req.category(), req.difficulty(), req.topic(), req.count(), model, maxTokens);

        scheduler.submit(() -> {
            long totalStart = System.currentTimeMillis();
            int total = Math.min(req.count(), 20);
            int success = 0;
            int fail = 0;
            List<Map<String, Object>> results = new ArrayList<>();

            try {
                for (int i = 0; i < total; i++) {
                    long iterStart = System.currentTimeMillis();
                    Map<String, Object> progressData = new HashMap<>();
                    progressData.put("current", i + 1);
                    progressData.put("total", total);
                    progressData.put("status", "generating");
                    sendEmitterJson(emitter, "progress", progressData);

                    GenerationRequest singleReq = new GenerationRequest(
                            req.category(), req.difficulty(), 1, req.topic());
                    String prompt = buildPrompt(singleReq);
                    log.info("流式生成 [{}/{}]: 调用 DeepSeek, prompt={}字符", i + 1, total, prompt.length());

                    StreamResult sr = callDeepSeekStreamInternal(prompt, emitter);
                    log.info("流式生成 [{}/{}]: 收到响应, content={}字符, reasoning={}字符, chunks={}",
                            i + 1, total, sr.content().length(), sr.reasoning().length(), sr.chunkCount());

                    String jsonContent = sr.content().replaceAll("(?s)^```json\\s*", "")
                            .replaceAll("(?s)\\s*```$", "").trim();
                    int start = jsonContent.indexOf('[');
                    int end = jsonContent.lastIndexOf(']');
                    if (start >= 0 && end > start) {
                        jsonContent = jsonContent.substring(start, end + 1);
                    }

                    JsonNode questionsArray = objectMapper.readTree(jsonContent);
                    if (!questionsArray.isArray() || questionsArray.size() == 0) {
                        fail++;
                        log.warn("流式生成 [{}/{}]: 响应中无有效题目", i + 1, total);
                        Map<String, Object> errData = new HashMap<>(progressData);
                        errData.put("status", "failed");
                        errData.put("error", "响应中无有效题目");
                        sendEmitterJson(emitter, "question_result", errData);
                        continue;
                    }

                    JsonNode item = questionsArray.get(0);
                    Question q = new Question();
                    q.setTitle(item.path("title").asText("未命名题目"));
                    q.setSummary(nullIfEmpty(item.path("summary").asText()));
                    q.setContent(item.path("content").asText(""));
                    q.setAnswer(item.path("content").asText(""));
                    q.setPrinciple(nullIfEmpty(item.path("principle").asText()));
                    q.setComparison(nullIfEmpty(item.path("comparison").asText()));
                    q.setScenario(nullIfEmpty(item.path("scenario").asText()));
                    q.setRisk(nullIfEmpty(item.path("risk").asText()));
                    q.setProjectExp(nullIfEmpty(item.path("project_exp").asText()));
                    q.setCodeExamples(nullIfEmpty(item.path("code_examples").toString()));
                    q.setDifficulty(item.path("difficulty").asText("MEDIUM"));
                    q.setStatus("DRAFT");
                    q.setSource("AI_GENERATED");
                    q.setCategoryId(resolveCategoryId(req.category()));

                    questionMapper.insert(q);
                    success++;

                    long iterTime = System.currentTimeMillis() - iterStart;
                    log.info("=== 流式生成 [{}/{}] 保存成功: id={}, title='{}', 耗时={}ms ===",
                            i + 1, total, q.getId(), truncate(q.getTitle(), 50), iterTime);

                    Map<String, Object> qResult = new HashMap<>(progressData);
                    qResult.put("status", "completed");
                    qResult.put("questionId", q.getId());
                    qResult.put("title", q.getTitle());
                    qResult.put("reasoning", sr.reasoning());
                    sendEmitterJson(emitter, "question_result", qResult);

                    results.add(qResult);
                }

                long totalTime = System.currentTimeMillis() - totalStart;
                log.info("===== 流式生成全部完成: 成功={}, 失败={}, 总耗时={}ms =====", success, fail, totalTime);

                Map<String, Object> doneData = new HashMap<>();
                doneData.put("total", total);
                doneData.put("success", success);
                doneData.put("fail", fail);
                doneData.put("results", results);
                doneData.put("totalTime", totalTime);
                sendEmitterJson(emitter, "done", doneData);
                try { emitter.complete(); } catch (Exception ignored) {}

            } catch (Exception e) {
                log.error("流式生成异常", e);
                sendEmitterEvent(emitter, "error", e.getMessage());
                try { emitter.completeWithError(e); } catch (Exception ignored) {}
            }
        });
    }

    /**
     * 流式补答案 — 逐题发送，实时进度和 AI 思考过程。
     */
    public void streamFillAnswer(Long categoryId, int count, SseEmitter emitter) {
        log.info("流式补答案启动: categoryId={}, count={}", categoryId, count);

        scheduler.submit(() -> {
            long totalStart = System.currentTimeMillis();
            try {
                LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                        .eq(Question::getStatus, "DRAFT")
                        .and(w -> w.isNull(Question::getContent).or().eq(Question::getContent, ""))
                        .orderByAsc(Question::getId)
                        .last("LIMIT " + count);
                if (categoryId != null) {
                    wrapper.eq(Question::getCategoryId, categoryId);
                }

                List<Question> drafts = questionMapper.selectList(wrapper);
                if (drafts.isEmpty()) {
                    log.warn("流式补答案: 没有待补题目, categoryId={}", categoryId);
                    sendEmitterEvent(emitter, "error", "没有待补题目");
                    try { emitter.complete(); } catch (Exception ignored) {}
                    return;
                }

                int total = drafts.size();
                int success = 0;
                int fail = 0;
                List<Map<String, Object>> results = new ArrayList<>();
                sendEmitterEvent(emitter, "total", String.valueOf(total));

                for (int i = 0; i < total; i++) {
                    long iterStart = System.currentTimeMillis();
                    Question q = drafts.get(i);

                    Map<String, Object> progressData = new HashMap<>();
                    progressData.put("current", i + 1);
                    progressData.put("total", total);
                    progressData.put("title", q.getTitle());
                    progressData.put("status", "generating");
                    sendEmitterJson(emitter, "progress", progressData);

                    log.info("流式补答案 [{}/{}]: id={}, title='{}'", i + 1, total, q.getId(), truncate(q.getTitle(), 50));

                    String prompt = buildFillPrompt(q.getTitle());
                    StreamResult sr = callDeepSeekStreamInternal(prompt, emitter);
                    log.info("流式补答案 [{}/{}]: 收到响应, content={}字符, reasoning={}字符",
                            i + 1, total, sr.content().length(), sr.reasoning().length());

                    String jsonContent = sr.content().replaceAll("(?s)^```(?:json)?\\s*", "")
                            .replaceAll("(?s)\\s*```$", "").trim();
                    JsonNode parsed;
                    if (jsonContent.startsWith("[")) {
                        parsed = objectMapper.readTree(jsonContent).get(0);
                    } else {
                        parsed = objectMapper.readTree(jsonContent);
                    }

                    if (parsed != null) {
                        Question update = new Question();
                        update.setId(q.getId());
                        update.setSummary(nullIfEmpty(parsed.path("summary").asText()));
                        update.setContent(parsed.path("content").asText(""));
                        update.setAnswer(parsed.path("content").asText(""));
                        update.setPrinciple(nullIfEmpty(parsed.path("principle").asText()));
                        update.setComparison(nullIfEmpty(parsed.path("comparison").asText()));
                        update.setScenario(nullIfEmpty(parsed.path("scenario").asText()));
                        update.setRisk(nullIfEmpty(parsed.path("risk").asText()));
                        update.setProjectExp(nullIfEmpty(parsed.path("project_exp").asText()));
                        update.setCodeExamples(nullIfEmpty(parsed.path("code_examples").toString()));
                        if (parsed.has("difficulty") && !parsed.path("difficulty").asText().isBlank()) {
                            update.setDifficulty(parsed.path("difficulty").asText());
                        }
                        questionMapper.updateById(update);
                        success++;

                        long iterTime = System.currentTimeMillis() - iterStart;
                        log.info("=== 流式补答案 [{}/{}] 成功: id={}, title='{}', 耗时={}ms ===",
                                i + 1, total, q.getId(), truncate(q.getTitle(), 50), iterTime);

                        Map<String, Object> qResult = new HashMap<>(progressData);
                        qResult.put("status", "completed");
                        qResult.put("questionId", q.getId());
                        qResult.put("reasoning", sr.reasoning());
                        sendEmitterJson(emitter, "question_result", qResult);
                        results.add(qResult);
                    } else {
                        fail++;
                        log.warn("流式补答案 [{}/{}]: 解析失败, id={}", i + 1, total, q.getId());
                        Map<String, Object> errData = new HashMap<>(progressData);
                        errData.put("status", "failed");
                        errData.put("error", "解析响应失败");
                        sendEmitterJson(emitter, "question_result", errData);
                    }
                }

                long totalTime = System.currentTimeMillis() - totalStart;
                log.info("===== 流式补答案全部完成: 成功={}, 失败={}, 总耗时={}ms =====", success, fail, totalTime);

                Map<String, Object> doneData = new HashMap<>();
                doneData.put("total", total);
                doneData.put("success", success);
                doneData.put("fail", fail);
                doneData.put("results", results);
                doneData.put("totalTime", totalTime);
                sendEmitterJson(emitter, "done", doneData);
                try { emitter.complete(); } catch (Exception ignored) {}

            } catch (Exception e) {
                log.error("流式补答案异常", e);
                sendEmitterEvent(emitter, "error", e.getMessage());
                try { emitter.completeWithError(e); } catch (Exception ignored) {}
            }
        });
    }

    // ==================== 内部方法 ====================

    private record StreamResult(String content, String reasoning, int chunkCount) {}

    /** 安全发送 SSE 事件，emitter 已完成后静默忽略。 */
    private void sendEmitterEvent(SseEmitter emitter, String name, String data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
        } catch (IllegalStateException e) {
            log.warn("发送 SSE 事件 '{}/{}' 失败: {}", name, truncate(data, 50), e.getMessage());
        } catch (Exception e) {
            log.warn("发送 SSE 事件 '{}/{}' 异常: {}", name, truncate(data, 50), e.getMessage());
        }
    }

    /** 安全发送 SSE 事件（JSON body）。 */
    private void sendEmitterJson(SseEmitter emitter, String name, Object body) {
        try {
            String json = objectMapper.writeValueAsString(body);
            sendEmitterEvent(emitter, name, json);
        } catch (Exception e) {
            log.warn("序列化 SSE 事件 '{}' 失败: {}", name, e.getMessage());
        }
    }

    /** 流式调用 DeepSeek，将 thinking/content 实时推送到 emitter。 */
    private StreamResult callDeepSeekStreamInternal(String prompt, SseEmitter emitter) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content",
                        "你是一位资深技术面试官，擅长出高质量面试题并给出详细解答。"),
                Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("max_tokens", maxTokens);
        requestBody.put("stream", true);

        try {
            String json = objectMapper.writeValueAsString(requestBody);

            HttpURLConnection conn = (HttpURLConnection) URI.create(apiUrl).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);
            conn.setRequestProperty("Accept", "text/event-stream");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(600000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            if (status != 200) {
                String errorBody = new String(
                        conn.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                log.error("DeepSeek 流式 API 错误: status={}, body={}", status, truncate(errorBody, 500));
                sendEmitterEvent(emitter, "error", "API 错误: " + status);
                throw new RuntimeException("DeepSeek API 错误: " + status);
            }

            StringBuilder fullContent = new StringBuilder();
            StringBuilder fullReasoning = new StringBuilder();
            int chunkCount = 0;

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.isEmpty()) { continue; }
                    if (!line.startsWith("data: ")) { continue; }

                    String data = line.substring(6).trim();
                    if ("[DONE]".equals(data)) { break; }

                    try {
                        JsonNode chunk = objectMapper.readTree(data);
                        JsonNode choice = chunk.path("choices").get(0);
                        if (choice == null || choice.isNull()) { continue; }
                        chunkCount++;

                        JsonNode delta = choice.path("delta");
                        String reasoning = delta.path("reasoning_content").asText(null);
                        if (reasoning != null && !reasoning.isEmpty()) {
                            fullReasoning.append(reasoning);
                            sendEmitterEvent(emitter, "thinking", reasoning);
                        }

                        String content = delta.path("content").asText(null);
                        if (content != null && !content.isEmpty()) {
                            fullContent.append(content);
                            sendEmitterEvent(emitter, "content", content);
                        }
                    } catch (Exception e) {
                        log.warn("解析 chunk 失败: {} — {}", truncate(line, 100), e.getMessage());
                    }
                }
            }

            return new StreamResult(fullContent.toString().trim(), fullReasoning.toString(), chunkCount);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("DeepSeek 流式调用异常", e);
            throw new RuntimeException("流式调用失败: " + e.getMessage(), e);
        }
    }

    /** 非流式调用 DeepSeek（供 generateSync 使用）。 */
    private String callDeepSeek(String prompt) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content",
                        "你是一位资深技术面试官，擅长出高质量面试题并给出详细解答。"),
                Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("max_tokens", maxTokens);

        log.info("非流式请求: model={}, prompt长度={}字符, maxTokens={}", model, prompt.length(), maxTokens);
        long t = System.currentTimeMillis();

        try {
            String json = objectMapper.writeValueAsString(requestBody);

            HttpURLConnection conn = (HttpURLConnection) URI.create(apiUrl).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);
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

            String errorBody = new String(
                    conn.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            log.error("DeepSeek API 错误: status={}, body={}", status, truncate(errorBody, 500));
            throw new RuntimeException("DeepSeek API 错误: " + status + " " + errorBody);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用 DeepSeek API 异常: {}", e.getMessage());
            throw new RuntimeException("调用 DeepSeek API 失败: " + e.getMessage(), e);
        }
    }

    private String buildPrompt(GenerationRequest req) {
        return """
            请生成 %d 道 %s 面试题，难度 %s。
            %s
            
            以 JSON 数组格式返回，每个元素包含以下字段：
            - title: 面试题目（字符串）
            - summary: 一句话摘要（50-100字）
            - content: 标准答案（Markdown 格式，详细完整）
            - principle: 原理解析（Markdown，深入底层机制）
            - comparison: 对比分析（Markdown，与同类技术对比，如无可为 null）
            - scenario: 适用场景（Markdown，如无可为 null）
            - risk: 风险与避坑（Markdown，如无可为 null）
            - project_exp: 项目实战经验（Markdown，如无可为 null）
            - code_examples: 代码示例数组，每个元素包含 lang（语言名）、title（标题）、code（代码）、description（说明），如无需为空数组
            - difficulty: 难度 EASY/MEDIUM/HARD
            
            只返回 JSON 数组，不要包含其他文字。
            """.formatted(req.count(), req.category(),
                    req.difficulty() != null ? req.difficulty() : "MEDIUM",
                    req.topic() != null ? "主题方向：" + req.topic() : "");
    }

    private String buildFillPrompt(String title) {
        return """
            请为以下面试题生成完整的结构化答案。
            
            题目：%s
            
            以 JSON 格式返回，包含以下字段：
            - summary: 一句话摘要（50-100字纯文本）
            - content: 标准答案（Markdown 格式，500-1500字，详细完整）
            - principle: 原理解析（Markdown，深入底层机制，200-800字）
            - comparison: 对比分析（Markdown，与同类技术对比，如无可为 null）
            - scenario: 适用场景（Markdown，如无可为 null）
            - risk: 风险与避坑（Markdown，如无可为 null）
            - project_exp: 项目实战经验（Markdown，如无可为 null）
            - code_examples: 代码示例数组 [{lang,title,code,description}]，如无需为空数组
            - difficulty: 难度 EASY/MEDIUM/HARD
            
            只返回 JSON 对象，不要包含其他文字。
            """.formatted(title);
    }

    private void logResponseUsage(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode usage = root.path("usage");
            if (!usage.isMissingNode()) {
                log.info("Token 用量: prompt={}, completion={}, total={}, reasoning_tokens={}",
                        usage.path("prompt_tokens").asInt(0),
                        usage.path("completion_tokens").asInt(0),
                        usage.path("total_tokens").asInt(0),
                        usage.path("prompt_tokens_details").path("reasoning_tokens").asInt(0));
            }
        } catch (Exception e) {
            log.debug("解析 usage 失败: {}", e.getMessage());
        }
    }

    private List<Question> parseQuestions(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode choice = root.path("choices").get(0);
            if (choice == null) {
                log.error("API 返回无 choices 字段");
                throw new RuntimeException("API 返回格式异常: 无 choices");
            }
            String content = choice.path("message").path("content").asText();
            int totalTokens = root.path("usage").path("total_tokens").asInt(0);
            log.info("解析响应: content={}字符, total_tokens={}", content.length(), totalTokens);

            content = content.replaceAll("(?s)^```json\\s*", "").replaceAll("(?s)\\s*```$", "").trim();
            int start = content.indexOf('[');
            int end = content.lastIndexOf(']');
            if (start >= 0 && end > start) {
                content = content.substring(start, end + 1);
            }

            JsonNode questionsArray = objectMapper.readTree(content);
            List<Question> questions = new ArrayList<>();

            if (questionsArray.isArray()) {
                for (JsonNode item : questionsArray) {
                    Question q = new Question();
                    q.setTitle(item.path("title").asText("未命名题目"));
                    q.setSummary(nullIfEmpty(item.path("summary").asText()));
                    q.setContent(item.path("content").asText(""));
                    q.setAnswer(item.path("content").asText(""));
                    q.setPrinciple(nullIfEmpty(item.path("principle").asText()));
                    q.setComparison(nullIfEmpty(item.path("comparison").asText()));
                    q.setScenario(nullIfEmpty(item.path("scenario").asText()));
                    q.setRisk(nullIfEmpty(item.path("risk").asText()));
                    q.setProjectExp(nullIfEmpty(item.path("project_exp").asText()));
                    q.setCodeExamples(nullIfEmpty(item.path("code_examples").toString()));
                    q.setDifficulty(item.path("difficulty").asText("MEDIUM"));
                    questions.add(q);
                }
            }
            log.info("解析完成: {} 道有效题目", questions.size());
            return questions;
        } catch (Exception e) {
            log.error("解析 AI 返回结果失败: {}", e.getMessage());
            log.debug("原始响应前500字符: {}", responseJson.substring(0, Math.min(500, responseJson.length())));
            throw new RuntimeException("解析 AI 返回结果失败: " + e.getMessage(), e);
        }
    }

    /**
     * 根据分类名称解析分类 ID。支持模糊匹配（包含关系）。
     */
    public Long resolveCategoryId(String categoryName) {
        if (categoryName == null || categoryName.isBlank()) {
            log.warn("分类名称为空，默认返回 categoryId=1");
            return 1L;
        }
        List<Category> all = categoryMapper.selectList(
                new LambdaQueryWrapper<Category>().select(Category::getId, Category::getName));
        for (Category c : all) {
            if (c.getName().equals(categoryName)) {
                log.debug("精确匹配分类: name='{}' -> id={}", categoryName, c.getId());
                return c.getId();
            }
        }
        for (Category c : all) {
            if (c.getName().contains(categoryName) || categoryName.contains(c.getName())) {
                log.debug("模糊匹配分类: '{}' -> '{}' id={}", categoryName, c.getName(), c.getId());
                return c.getId();
            }
        }
        log.warn("未匹配到分类 '{}'，默认使用 categoryId=1", categoryName);
        return 1L;
    }

    private String nullIfEmpty(String val) {
        return (val == null || val.isBlank() || "null".equals(val)) ? null : val;
    }

    private String truncate(String s, int max) {
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
