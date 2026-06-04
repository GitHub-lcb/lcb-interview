package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/**
 * AI 题目生成服务。调用 DeepSeek API 批量生成面试题目。
 * 异步执行，前端轮询任务状态。任务状态内存存储（重启丢失）。
 * @author chongan
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiQuestionService {

    private final QuestionMapper questionMapper;
    private final CategoryMapper categoryMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, GenerationTaskVO> taskStore = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    @Value("${ai.deepseek.api-key}")
    private String apiKey;

    @Value("${ai.deepseek.model:deepseek-v4-flash}")
    private String model;

    @Value("${ai.deepseek.url:https://opencode.ai/zen/go/v1/chat/completions}")
    private String apiUrl;

    /**
     * 异步生成题目。每次 API 只生成 1 道题，循环 count 次，避免超时。
     */
    public Long generate(GenerationRequest req) {
        Long taskId = System.currentTimeMillis();
        log.info("AI生成任务创建 taskId={}, category={}, difficulty={}, count={}, topic={}",
                taskId, req.category(), req.difficulty(), req.count(), req.topic());

        taskStore.put(taskId, new GenerationTaskVO(taskId, "RUNNING", req.count(), 0, 0, "构建 prompt...", List.of(), List.of()));

        scheduler.submit(() -> {
            List<String> errors = new ArrayList<>();
            List<Long> generatedIds = new ArrayList<>();
            int success = 0;
            int fail = 0;

            long startTime = System.currentTimeMillis();

            for (int i = 1; i <= req.count(); i++) {
                try {
                    updateProgress(taskId, req.count(), success, fail,
                            String.format("生成中 %d/%d", i, req.count()));

                    GenerationRequest singleReq = new GenerationRequest(
                            req.category(), req.difficulty(), 1, req.topic());
                    String prompt = buildPrompt(singleReq);
                    String responseJson = callDeepSeek(prompt);
                    List<Question> questions = parseQuestions(responseJson);

                    if (questions.isEmpty()) {
                        fail++;
                        errors.add("第 " + i + " 题: API 返回为空");
                        continue;
                    }

                    Question q = questions.get(0);
                    q.setStatus("DRAFT");
                    q.setSource("AI_GENERATED");
                    q.setCategoryId(resolveCategoryId(req.category()));
                    questionMapper.insert(q);
                    generatedIds.add(q.getId());
                    success++;

                    updateProgress(taskId, req.count(), success, fail,
                            String.format("保存中 %d/%d", i, req.count()));
                    log.info("保存题目成功 [{}/{}]: id={}, title={}", i, req.count(), q.getId(), q.getTitle());
                } catch (Exception e) {
                    log.error("生成题目失败 [{}]", i, e);
                    errors.add("第 " + i + " 题: " + e.getMessage());
                    fail++;
                }
            }

            long totalTime = System.currentTimeMillis() - startTime;
            String taskStatus = fail == 0 ? "COMPLETED" : (success > 0 ? "PARTIAL" : "FAILED");
            log.info("AI生成任务完成 taskId={}, status={}, success={}, fail={}, 总耗时 {}ms",
                    taskId, taskStatus, success, fail, totalTime);

            taskStore.put(taskId, new GenerationTaskVO(
                    taskId, taskStatus, req.count(), success, fail,
                    taskStatus.equals("FAILED") ? errors.isEmpty() ? "生成失败" : errors.get(0) : "完成",
                    List.copyOf(errors), List.copyOf(generatedIds)));
        });

        return taskId;
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

    private String callDeepSeek(String prompt) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content",
                        "你是一位资深技术面试官，擅长出高质量面试题并给出详细解答。"),
                Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("max_tokens", 8192);

        log.info("发送请求到 DeepSeek, model={}, prompt长度={}", model, prompt.length());
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
            log.info("DeepSeek 响应状态码={}, 耗时 {}ms", status, System.currentTimeMillis() - t);

            if (status == 200) {
                String response = new String(
                        conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                log.info("DeepSeek 响应长度 {} 字符", response.length());
                return response;
            }

            String errorBody = new String(
                    conn.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            log.error("DeepSeek API 错误: status={}, body={}", status, errorBody);
            throw new RuntimeException("DeepSeek API 错误: " + status + " " + errorBody);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用 DeepSeek API 异常", e);
            throw new RuntimeException("调用 DeepSeek API 失败: " + e.getMessage(), e);
        }
    }

    private List<Question> parseQuestions(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode choice = root.path("choices").get(0);
            if (choice == null) {
                log.error("API 返回无 choices 字段, 原始响应: {}", responseJson);
                throw new RuntimeException("API 返回格式异常: 无 choices");
            }
            String content = choice.path("message").path("content").asText();
            int totalTokens = root.path("usage").path("total_tokens").asInt(0);
            log.info("解析响应, content 长度={} 字符, usage total_tokens={}", content.length(), totalTokens);

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
            log.error("解析 AI 返回结果失败, 原始响应长度={}", responseJson.length());
            log.debug("原始响应前500字符: {}", responseJson.substring(0, Math.min(500, responseJson.length())));
            throw new RuntimeException("解析 AI 返回结果失败: " + e.getMessage(), e);
        }
    }

    private String nullIfEmpty(String val) {
        return (val == null || val.isBlank() || "null".equals(val)) ? null : val;
    }

    /**
     * 查询生成任务状态。
     */
    public GenerationTaskVO getTask(Long taskId) {
        return taskStore.get(taskId);
    }

    /**
     * 根据分类名称解析分类 ID。支持模糊匹配（包含关系）。
     *
     * @param categoryName 分类名称
     * @return 分类 ID，未匹配时返回 1L（Java 基础）
     */
    public Long resolveCategoryId(String categoryName) {
        if (categoryName == null || categoryName.isBlank()) {
            return 1L;
        }
        List<Category> all = categoryMapper.selectList(
                new LambdaQueryWrapper<Category>().select(Category::getId, Category::getName));
        for (Category c : all) {
            if (c.getName().equals(categoryName)) {
                return c.getId();
            }
        }
        for (Category c : all) {
            if (c.getName().contains(categoryName) || categoryName.contains(c.getName())) {
                return c.getId();
            }
        }
        log.warn("未匹配到分类 '{}'，默认使用 categoryId=1", categoryName);
        return 1L;
    }

    private void updateProgress(Long taskId, int total, int success, int fail, String message) {
        GenerationTaskVO current = taskStore.get(taskId);
        if (current != null) {
            taskStore.put(taskId, new GenerationTaskVO(
                    taskId, "RUNNING", total, success, fail, message,
                    current.errors(), current.generatedIds()));
        }
    }

    /**
     * 为已有 DRAFT 题目补全答案。读取指定分类下 content 为空的草稿，
     * 以题目为 prompt 调用 AI 生成完整答案并更新。
     */
    public Long fillAnswers(Long categoryId, int count) {
        Long taskId = System.currentTimeMillis();
        log.info("AI补答案任务创建 taskId={}, categoryId={}, count={}", taskId, categoryId, count);

        taskStore.put(taskId, new GenerationTaskVO(taskId, "RUNNING", count, 0, 0, "查询待补题目...", List.of(), List.of()));

        scheduler.submit(() -> {
            List<String> errors = new ArrayList<>();
            List<Long> updatedIds = new ArrayList<>();
            int success = 0;
            int fail = 0;
            long startTime = System.currentTimeMillis();

            // 查询 DRAFT 待补题目
            LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                    .eq(Question::getStatus, "DRAFT")
                    .and(w -> w.isNull(Question::getContent).or().eq(Question::getContent, ""))
                    .orderByAsc(Question::getId);
            if (categoryId != null) {
                wrapper.eq(Question::getCategoryId, categoryId);
            }
            wrapper.last("LIMIT " + count);

            List<Question> draftQuestions = questionMapper.selectList(wrapper);
            log.info("找到 {} 道待补题目", draftQuestions.size());

            int total = Math.min(draftQuestions.size(), count);
            taskStore.put(taskId, new GenerationTaskVO(taskId, "RUNNING", total, 0, 0, "开始补全...", List.of(), List.of()));

            for (int i = 0; i < total; i++) {
                Question q = draftQuestions.get(i);
                try {
                    updateProgress(taskId, total, success, fail,
                            String.format("补全中 %d/%d: %s", i + 1, total, truncate(q.getTitle(), 30)));

                    String prompt = buildFillPrompt(q.getTitle());
                    String responseJson = callDeepSeek(prompt);
                    List<Question> parsed = parseQuestions(responseJson);

                    if (parsed.isEmpty()) {
                        fail++;
                        errors.add("第 " + (i + 1) + " 题: API 返回为空");
                        continue;
                    }

                    Question answer = parsed.get(0);
                    Question update = new Question();
                    update.setId(q.getId());
                    update.setSummary(answer.getSummary());
                    update.setContent(answer.getContent());
                    update.setPrinciple(answer.getPrinciple());
                    update.setComparison(answer.getComparison());
                    update.setScenario(answer.getScenario());
                    update.setRisk(answer.getRisk());
                    update.setProjectExp(answer.getProjectExp());
                    update.setCodeExamples(answer.getCodeExamples());
                    if (answer.getDifficulty() != null && !answer.getDifficulty().isBlank()) {
                        update.setDifficulty(answer.getDifficulty());
                    }
                    questionMapper.updateById(update);
                    updatedIds.add(q.getId());
                    success++;

                    log.info("补全答案成功 [{}/{}]: id={}, title={}", i + 1, total, q.getId(), q.getTitle());
                } catch (Exception e) {
                    log.error("补全答案失败 [{}]: id={}, title={}", i + 1, q.getId(), q.getTitle(), e);
                    errors.add("第 " + (i + 1) + " 题: " + e.getMessage());
                    fail++;
                }
            }

            long totalTime = System.currentTimeMillis() - startTime;
            String taskStatus = fail == 0 ? "COMPLETED" : (success > 0 ? "PARTIAL" : "FAILED");
            log.info("AI补答案任务完成 taskId={}, status={}, success={}, fail={}, 总耗时 {}ms",
                    taskId, taskStatus, success, fail, totalTime);

            taskStore.put(taskId, new GenerationTaskVO(
                    taskId, taskStatus, total, success, fail,
                    taskStatus.equals("FAILED") ? errors.isEmpty() ? "补全失败" : errors.get(0) : "完成",
                    List.copyOf(errors), List.copyOf(updatedIds)));
        });

        return taskId;
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

    private String truncate(String s, int max) {
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max) + "...";
    }

    /** 同步生成题目（供 BatchGenerationRunner 调用）。
     *
     * @param req      生成请求
     * @param categoryId 目标分类 ID
     * @return 成功保存的题目 ID 列表
     */
    public List<Long> generateSync(GenerationRequest req, Long categoryId) {
        log.info("同步生成: category={}, categoryId={}, count={}, topic={}",
                req.category(), categoryId, req.count(), req.topic());

        String prompt = buildPrompt(req);
        String responseJson = callDeepSeek(prompt);
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
            log.info("同步保存 [{}/{}]: id={}, title={}", i + 1, toSave, q.getId(), q.getTitle());
        }
        return ids;
    }
}
