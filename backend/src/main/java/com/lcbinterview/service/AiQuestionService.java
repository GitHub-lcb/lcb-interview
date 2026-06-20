package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.QuestionTagName;
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
    private final AiAnswerQualityPolicy answerQualityPolicy;
    private final QuestionTitleDeduplicator titleDeduplicator;
    private final AiGenerationRequestPolicy requestPolicy;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private static final int ANSWER_QUALITY_MAX_ATTEMPTS = 3;

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
        GenerationRequest safeReq = new GenerationRequest(
                req.category(), req.difficulty(), requestPolicy.clampCount(req.count()), req.topic());
        log.info("同步生成: category='{}', categoryId={}, count={}, topic='{}', 模型={}, maxTokens={}",
                safeReq.category(), categoryId, safeReq.count(), safeReq.topic(), model, maxTokens);

        String prompt = answerQualityPolicy.buildQuestionPrompt(safeReq);
        log.info("调用 DeepSeek, prompt长度={}字符", prompt.length());
        long t = System.currentTimeMillis();

        String responseJson = callDeepSeek(prompt);
        logResponseUsage(responseJson);
        List<Question> questions = parseQuestions(responseJson);
        List<Question> existingQuestions = loadComparableQuestions(categoryId);

        List<Long> ids = new ArrayList<>();
        int toSave = Math.min(questions.size(), safeReq.count());
        for (int i = 0; i < toSave; i++) {
            Question q = questions.get(i);
            AiAnswerQualityPolicy.QualityReport qualityReport =
                    answerQualityPolicy.evaluateGeneratedQuestion(safeReq.category(), q);
            if (!qualityReport.passed()) {
                log.warn("同步生成跳过低质量题目 [{}/{}]: title='{}', {}",
                        i + 1, toSave, truncate(q.getTitle(), 50), formatQualityIssues(qualityReport));
                continue;
            }
            if (titleDeduplicator.isDuplicate(q.getTitle(), existingQuestions)) {
                log.warn("同步生成跳过重复题目 [{}/{}]: title='{}'", i + 1, toSave, truncate(q.getTitle(), 50));
                continue;
            }

            q.setStatus("DRAFT");
            q.setSource("AI_GENERATED");
            q.setCategoryId(categoryId);
            questionMapper.insert(q);
            ids.add(q.getId());
            existingQuestions.add(q);
            log.info("同步保存 [{}/{}]: id={}, title='{}'", i + 1, toSave, q.getId(), truncate(q.getTitle(), 50));
        }

        long elapsed = System.currentTimeMillis() - t;
        log.info("同步生成完成: category='{}', 成功={}道, 耗时={}ms", safeReq.category(), ids.size(), elapsed);
        return ids;
    }

    // ==================== SSE 流式方法 ====================

    /**
     * 流式生成题目 — 每道题独立发送一次请求，逐题展示进度和 AI 思考过程。
     */
    public void streamGenerate(GenerationRequest req, SseEmitter emitter) {
        GenerationRequest safeReq = new GenerationRequest(
                req.category(), req.difficulty(), requestPolicy.clampCount(req.count()), req.topic());
        SseStreamSession session = SseStreamSession.open(emitter);
        log.info("流式生成启动: category='{}', difficulty={}, topic='{}', count={}, 模型={}, maxTokens={}",
                safeReq.category(), safeReq.difficulty(), safeReq.topic(), safeReq.count(), model, maxTokens);

        scheduler.submit(() -> {
            long totalStart = System.currentTimeMillis();
            int total = safeReq.count();
            int success = 0;
            int fail = 0;
            List<Map<String, Object>> results = new ArrayList<>();
            Long categoryId = resolveCategoryId(safeReq.category());
            List<Question> existingQuestions = loadComparableQuestions(categoryId);

            try {
                for (int i = 0; i < total; i++) {
                    long iterStart = System.currentTimeMillis();
                    Map<String, Object> progressData = new HashMap<>();
                    progressData.put("current", i + 1);
                    progressData.put("total", total);
                    progressData.put("status", "generating");
                    sendJsonOrStop(session, "progress", progressData);

                    Question q = null;
                    String reasoning = "";
                    AiAnswerQualityPolicy.QualityReport qualityReport = null;
                    String lastError = null;

                    for (int attempt = 1; attempt <= ANSWER_QUALITY_MAX_ATTEMPTS; attempt++) {
                        GenerationRequest singleReq = new GenerationRequest(
                                safeReq.category(), safeReq.difficulty(), 1, safeReq.topic());
                        String prompt = answerQualityPolicy.buildQuestionPrompt(singleReq);
                        if (qualityReport != null) {
                            prompt = prompt + buildQualityRetryInstruction(qualityReport);
                        }
                        log.info("流式生成 [{}/{}]: 第 {} 次调用 DeepSeek, prompt={}字符",
                                i + 1, total, attempt, prompt.length());

                        try {
                            StreamResult sr = callDeepSeekStreamInternal(prompt, session);
                            reasoning = sr.reasoning();
                            log.info("流式生成 [{}/{}]: 第 {} 次收到响应, content={}字符, reasoning={}字符, chunks={}",
                                    i + 1, total, attempt, sr.content().length(), sr.reasoning().length(), sr.chunkCount());

                            JsonNode questionsArray = parseQuestionArray(sr.content());
                            if (!questionsArray.isArray() || questionsArray.isEmpty()) {
                                lastError = "响应中无有效题目";
                                log.warn("流式生成 [{}/{}]: 第 {} 次响应中无有效题目", i + 1, total, attempt);
                                continue;
                            }

                            q = toQuestion(questionsArray.get(0));
                            qualityReport = answerQualityPolicy.evaluateGeneratedQuestion(safeReq.category(), q);
                            if (!qualityReport.passed()) {
                                lastError = formatQualityIssues(qualityReport);
                                log.warn("流式生成 [{}/{}]: 第 {} 次质量未达标, {}",
                                        i + 1, total, attempt, lastError);
                                continue;
                            }
                            if (titleDeduplicator.isDuplicate(q.getTitle(), existingQuestions)) {
                                qualityReport = new AiAnswerQualityPolicy.QualityReport(
                                        0, List.of("title 与已有题目重复"));
                                lastError = formatQualityIssues(qualityReport);
                                log.warn("流式生成 [{}/{}]: 第 {} 次标题重复, title='{}'",
                                        i + 1, total, attempt, truncate(q.getTitle(), 50));
                                continue;
                            }

                            break;
                        } catch (SseStreamClosedException e) {
                            throw e;
                        } catch (Exception e) {
                            lastError = e.getMessage();
                            log.warn("流式生成 [{}/{}]: 第 {} 次生成异常, error={}",
                                    i + 1, total, attempt, e.getMessage());
                        }
                    }

                    if (q == null || qualityReport == null || !qualityReport.passed()
                            || titleDeduplicator.isDuplicate(q.getTitle(), existingQuestions)) {
                        fail++;
                        Map<String, Object> errData = new HashMap<>(progressData);
                        errData.put("status", "failed");
                        errData.put("error", lastError == null ? "题目质量未达标" : lastError);
                        if (qualityReport != null) {
                            errData.put("qualityScore", qualityReport.score());
                            errData.put("qualityIssues", qualityReport.issues());
                        }
                        sendJsonOrStop(session, "question_result", errData);
                        continue;
                    }

                    q.setStatus("DRAFT");
                    q.setSource("AI_GENERATED");
                    q.setCategoryId(categoryId);

                    questionMapper.insert(q);
                    success++;
                    existingQuestions.add(q);

                    long iterTime = System.currentTimeMillis() - iterStart;
                    log.info("=== 流式生成 [{}/{}] 保存成功: id={}, title='{}', 耗时={}ms ===",
                            i + 1, total, q.getId(), truncate(q.getTitle(), 50), iterTime);

                    Map<String, Object> qResult = new HashMap<>(progressData);
                    qResult.put("status", "completed");
                    qResult.put("questionId", q.getId());
                    qResult.put("title", q.getTitle());
                    qResult.put("qualityScore", qualityReport.score());
                    qResult.put("reasoning", reasoning);
                    sendJsonOrStop(session, "question_result", qResult);

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
                sendJsonOrStop(session, "done", doneData);
                session.complete();

            } catch (SseStreamClosedException e) {
                log.info("流式生成连接已关闭，停止后台任务: {}", e.getMessage());
            } catch (Exception e) {
                log.error("流式生成异常", e);
                session.sendEvent("error", e.getMessage());
                session.completeWithError(e);
            }
        });
    }

    /**
     * 流式补答案 — 逐题发送，实时进度和 AI 思考过程。
     */
    public void streamFillAnswer(Long categoryId, int count, SseEmitter emitter) {
        int safeCount = requestPolicy.clampCount(count);
        SseStreamSession session = SseStreamSession.open(emitter);
        log.info("流式补答案启动: categoryId={}, count={}", categoryId, safeCount);

        scheduler.submit(() -> {
            long totalStart = System.currentTimeMillis();
            try {
                LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                        .eq(Question::getStatus, "DRAFT")
                        .and(w -> w.isNull(Question::getContent).or().eq(Question::getContent, ""))
                        .orderByAsc(Question::getId)
                        .last("LIMIT " + safeCount);
                if (categoryId != null) {
                    wrapper.eq(Question::getCategoryId, categoryId);
                }

                List<Question> drafts = questionMapper.selectList(wrapper);
                if (drafts.isEmpty()) {
                    log.warn("流式补答案: 没有待补题目, categoryId={}", categoryId);
                    session.sendEvent("error", "没有待补题目");
                    session.complete();
                    return;
                }

                int total = drafts.size();
                int success = 0;
                int fail = 0;
                List<Map<String, Object>> results = new ArrayList<>();
                sendEventOrStop(session, "total", String.valueOf(total));

                for (int i = 0; i < total; i++) {
                    long iterStart = System.currentTimeMillis();
                    Question q = drafts.get(i);

                    Map<String, Object> progressData = new HashMap<>();
                    progressData.put("current", i + 1);
                    progressData.put("total", total);
                    progressData.put("title", q.getTitle());
                    progressData.put("status", "generating");
                    sendJsonOrStop(session, "progress", progressData);

                    log.info("流式补答案 [{}/{}]: id={}, title='{}'", i + 1, total, q.getId(), truncate(q.getTitle(), 50));

                    FillContext context = loadFillContext(q);
                    Question update = null;
                    String reasoning = "";
                    AiAnswerQualityPolicy.QualityReport qualityReport = null;
                    String lastError = null;

                    for (int attempt = 1; attempt <= ANSWER_QUALITY_MAX_ATTEMPTS; attempt++) {
                        String prompt = answerQualityPolicy.buildFillPrompt(q, context.categoryName(), context.tags());
                        if (qualityReport != null) {
                            prompt = prompt + buildQualityRetryInstruction(qualityReport);
                        }
                        log.info("流式补答案 [{}/{}]: 第 {} 次生成, prompt={}字符",
                                i + 1, total, attempt, prompt.length());

                        try {
                            StreamResult sr = callDeepSeekStreamInternal(prompt, session);
                            reasoning = sr.reasoning();
                            log.info("流式补答案 [{}/{}]: 第 {} 次收到响应, content={}字符, reasoning={}字符",
                                    i + 1, total, attempt, sr.content().length(), sr.reasoning().length());

                            JsonNode parsed = parseAnswerObject(sr.content());
                            if (parsed == null) {
                                lastError = "响应中无有效答案对象";
                                log.warn("流式补答案 [{}/{}]: 第 {} 次解析失败, id={}",
                                        i + 1, total, attempt, q.getId());
                                continue;
                            }

                            qualityReport = answerQualityPolicy.evaluate(q, context.categoryName(), context.tags(), parsed);
                            if (!qualityReport.passed()) {
                                lastError = formatQualityIssues(qualityReport);
                                log.warn("流式补答案 [{}/{}]: 第 {} 次质量未达标, id={}, {}",
                                        i + 1, total, attempt, q.getId(), lastError);
                                continue;
                            }

                            update = toQuestionUpdate(q.getId(), parsed);
                            break;
                        } catch (SseStreamClosedException e) {
                            throw e;
                        } catch (Exception e) {
                            lastError = e.getMessage();
                            log.warn("流式补答案 [{}/{}]: 第 {} 次生成异常, id={}, error={}",
                                    i + 1, total, attempt, q.getId(), e.getMessage());
                        }
                    }

                    if (update != null) {
                        questionMapper.updateById(update);
                        success++;

                        long iterTime = System.currentTimeMillis() - iterStart;
                        log.info("=== 流式补答案 [{}/{}] 成功: id={}, title='{}', 耗时={}ms ===",
                                i + 1, total, q.getId(), truncate(q.getTitle(), 50), iterTime);

                        Map<String, Object> qResult = new HashMap<>(progressData);
                        qResult.put("status", "completed");
                        qResult.put("questionId", q.getId());
                        qResult.put("qualityScore", qualityReport == null ? null : qualityReport.score());
                        qResult.put("reasoning", reasoning);
                        sendJsonOrStop(session, "question_result", qResult);
                        results.add(qResult);
                    } else {
                        fail++;
                        log.warn("流式补答案 [{}/{}]: 多次生成后仍未达标, id={}, error={}",
                                i + 1, total, q.getId(), lastError);
                        Map<String, Object> errData = new HashMap<>(progressData);
                        errData.put("status", "failed");
                        errData.put("error", lastError == null ? "答案质量未达标" : lastError);
                        if (qualityReport != null) {
                            errData.put("qualityScore", qualityReport.score());
                            errData.put("qualityIssues", qualityReport.issues());
                        }
                        sendJsonOrStop(session, "question_result", errData);
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
                sendJsonOrStop(session, "done", doneData);
                session.complete();

            } catch (SseStreamClosedException e) {
                log.info("流式补答案连接已关闭，停止后台任务: {}", e.getMessage());
            } catch (Exception e) {
                log.error("流式补答案异常", e);
                session.sendEvent("error", e.getMessage());
                session.completeWithError(e);
            }
        });
    }

    // ==================== 内部方法 ====================

    private record StreamResult(String content, String reasoning, int chunkCount) {}

    private record FillContext(String categoryName, List<String> tags) {}

    private static class SseStreamClosedException extends RuntimeException {
        private SseStreamClosedException(String message) {
            super(message);
        }
    }

    private FillContext loadFillContext(Question question) {
        String categoryName = "未知分类";
        if (question.getCategoryId() != null) {
            Category category = categoryMapper.selectById(question.getCategoryId());
            if (category != null && category.getName() != null && !category.getName().isBlank()) {
                categoryName = category.getName();
            }
        }

        List<String> tags = List.of();
        if (question.getId() != null) {
            tags = questionMapper.selectTagNamesByQuestionIds(List.of(question.getId()))
                    .stream()
                    .map(QuestionTagName::tagName)
                    .filter(name -> name != null && !name.isBlank())
                    .toList();
        }
        return new FillContext(categoryName, tags);
    }

    private JsonNode parseAnswerObject(String content) throws Exception {
        String jsonContent = content.replaceAll("(?s)^```(?:json)?\\s*", "")
                .replaceAll("(?s)\\s*```$", "").trim();
        if (jsonContent.startsWith("[")) {
            JsonNode array = objectMapper.readTree(jsonContent);
            return array.isArray() && !array.isEmpty() ? array.get(0) : null;
        }
        return objectMapper.readTree(jsonContent);
    }

    private JsonNode parseQuestionArray(String content) throws Exception {
        String jsonContent = content.replaceAll("(?s)^```(?:json)?\\s*", "")
                .replaceAll("(?s)\\s*```$", "").trim();
        int start = jsonContent.indexOf('[');
        int end = jsonContent.lastIndexOf(']');
        if (start >= 0 && end > start) {
            jsonContent = jsonContent.substring(start, end + 1);
        }
        return objectMapper.readTree(jsonContent);
    }

    private Question toQuestion(JsonNode item) {
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
        return q;
    }

    private Question toQuestionUpdate(Long questionId, JsonNode parsed) {
        Question update = new Question();
        update.setId(questionId);
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
        return update;
    }

    private String buildQualityRetryInstruction(AiAnswerQualityPolicy.QualityReport report) {
        return """

                ## 上一版质量检查未通过
                质量分：%d
                问题列表：%s

                请针对以上问题完整重写答案，不要只局部补丁。
                """.formatted(report.score(), String.join("；", report.issues()));
    }

    private String formatQualityIssues(AiAnswerQualityPolicy.QualityReport report) {
        return "质量分 " + report.score() + "，问题：" + String.join("；", report.issues());
    }

    private void sendEventOrStop(SseStreamSession session, String name, String data) {
        if (!session.sendEvent(name, data)) {
            throw new SseStreamClosedException("发送事件失败: " + name);
        }
    }

    private void sendJsonOrStop(SseStreamSession session, String name, Object body) {
        if (!session.sendJson(name, body, objectMapper)) {
            throw new SseStreamClosedException("发送事件失败: " + name);
        }
    }

    /** 流式调用 DeepSeek，将 thinking/content 实时推送到 emitter。 */
    private StreamResult callDeepSeekStreamInternal(String prompt, SseStreamSession session) {
        if (!session.isOpen()) {
            throw new SseStreamClosedException("SSE 连接已关闭");
        }

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

        HttpURLConnection conn = null;
        try {
            String json = objectMapper.writeValueAsString(requestBody);

            conn = (HttpURLConnection) URI.create(apiUrl).toURL().openConnection();
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
                sendEventOrStop(session, "error", "API 错误: " + status);
                throw new RuntimeException("DeepSeek API 错误: " + status);
            }

            StringBuilder fullContent = new StringBuilder();
            StringBuilder fullReasoning = new StringBuilder();
            int chunkCount = 0;

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!session.isOpen()) {
                        throw new SseStreamClosedException("SSE 连接已关闭");
                    }
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
                            sendEventOrStop(session, "thinking", reasoning);
                        }

                        String content = delta.path("content").asText(null);
                        if (content != null && !content.isEmpty()) {
                            fullContent.append(content);
                            sendEventOrStop(session, "content", content);
                        }
                    } catch (SseStreamClosedException e) {
                        throw e;
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
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
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

            JsonNode questionsArray = parseQuestionArray(content);
            List<Question> questions = new ArrayList<>();

            if (questionsArray.isArray()) {
                for (JsonNode item : questionsArray) {
                    questions.add(toQuestion(item));
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

    private List<Question> loadComparableQuestions(Long categoryId) {
        if (categoryId == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(questionMapper.selectList(
                new LambdaQueryWrapper<Question>()
                        .select(Question::getId, Question::getTitle)
                        .eq(Question::getCategoryId, categoryId)
                        .in(Question::getStatus, List.of("DRAFT", "PUBLISHED"))));
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
