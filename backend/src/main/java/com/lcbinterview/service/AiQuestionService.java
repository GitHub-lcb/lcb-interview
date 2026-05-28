package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, GenerationTaskVO> taskStore = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    @Value("${deepseek.api-key}")
    private String apiKey;

    @Value("${deepseek.model:deepseek-v4-flash}")
    private String model;

    @Value("${deepseek.url:https://api.deepseek.com/chat/completions}")
    private String apiUrl;

    /**
     * 异步生成题目。分批调用 DeepSeek API，每批最多 5 题。
     */
    public Long generate(GenerationRequest req) {
        Long taskId = System.currentTimeMillis();
        taskStore.put(taskId, new GenerationTaskVO(taskId, "RUNNING", req.count(), 0, 0, List.of(), List.of()));

        scheduler.submit(() -> {
            List<String> errors = new ArrayList<>();
            List<Long> generatedIds = new ArrayList<>();
            int success = 0;
            int fail = 0;
            int batchSize = Math.min(req.count(), 5);

            try {
                String prompt = buildPrompt(req);
                String responseJson = callDeepSeek(prompt);
                List<Question> questions = parseQuestions(responseJson);

                for (int i = 0; i < Math.min(questions.size(), req.count()); i++) {
                    try {
                        Question q = questions.get(i);
                        q.setStatus("DRAFT");
                        q.setSource("AI_GENERATED");
                        q.setCategoryId(1L);
                        questionMapper.insert(q);
                        generatedIds.add(q.getId());
                        success++;
                    } catch (Exception e) {
                        log.error("保存题目失败", e);
                        errors.add("第 " + (i + 1) + " 题保存失败: " + e.getMessage());
                        fail++;
                    }
                }

                if (questions.size() < req.count()) {
                    errors.add("API 返回了 " + questions.size() + " 道题，少于请求的 " + req.count());
                }
            } catch (Exception e) {
                log.error("AI 生成任务异常", e);
                errors.add("任务执行异常: " + e.getMessage());
                fail = req.count() - success;
            }

            String taskStatus = fail == 0 ? "COMPLETED" : (success > 0 ? "PARTIAL" : "FAILED");
            taskStore.put(taskId, new GenerationTaskVO(
                    taskId, taskStatus, req.count(), success, fail,
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
        requestBody.put("max_tokens", 65536);

        RestClient restClient = RestClient.create();
        return restClient.post()
                .uri(apiUrl)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .retrieve()
                .body(String.class);
    }

    private List<Question> parseQuestions(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            String content = root.path("choices").get(0).path("message").path("content").asText();
            // 如果有 reasoning_content（思考模式输出），忽略它，只取 content

            // 清理可能的 Markdown 代码块标记
            content = content.replaceAll("(?s)^```json\\s*", "").replaceAll("(?s)\\s*```$", "").trim();
            // 找到第一个 [ 和最后一个 ] 之间的内容（容错处理）
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
            return questions;
        } catch (Exception e) {
            log.error("解析 AI 返回结果失败，原始响应长度={}", responseJson.length());
            log.debug("原始响应: {}", responseJson);
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
}
