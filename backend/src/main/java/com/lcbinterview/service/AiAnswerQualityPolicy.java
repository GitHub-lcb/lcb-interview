package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.model.Question;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * AI 答案质量策略。集中维护补答案提示词模板和本地质量门禁，避免低质量回答直接写入题库。
 */
@Component
public class AiAnswerQualityPolicy {

    private static final int PASS_SCORE = 85;
    private static final Set<String> VALID_DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 构建带题目上下文和质量标准的补答案提示词。
     *
     * @param question     待补答案题目
     * @param categoryName 分类名称
     * @param tags         标签名称列表
     * @return 可直接发送给大模型的提示词
     */
    public String buildFillPrompt(Question question, String categoryName, List<String> tags) {
        String safeCategoryName = textOrDefault(categoryName, "未知分类");
        String safeDifficulty = textOrDefault(question.getDifficulty(), "MEDIUM");
        String tagText = tags == null || tags.isEmpty() ? "无" : String.join("、", tags);

        return """
                请为下面这道技术面试题生成一份可直接发布的高质量中文答案。

                ## 题目上下文
                题目：%s
                分类：%s
                难度：%s
                标签：%s

                ## 输出格式
                只返回 JSON 对象，不要返回 Markdown 代码围栏，不要输出额外解释。
                JSON 字段必须包含：
                - summary: 50-120 字纯文本，给出 30 秒速览结论
                - content: Markdown，至少 500 字，必须包含「30 秒口述版」「标准答案」「面试官评分点」「高频追问」四段
                - principle: Markdown，至少 120 字，解释底层机制和关键链路
                - comparison: Markdown，至少 80 字，对比相近方案、概念或常见误解
                - scenario: Markdown，至少 80 字，说明适用场景和不适用场景
                - risk: Markdown，至少 80 字，列出线上风险、边界条件和常见坑
                - project_exp: Markdown，至少 80 字，给出可以在面试中复述的项目经验表达
                - code_examples: 数组。涉及代码、SQL、算法、配置、并发、框架用法时必须至少 1 个示例；每项包含 lang、title、code、description
                - difficulty: EASY/MEDIUM/HARD

                ## 质量门槛
                - 先给可口述的答案，再展开原理，不要只堆概念
                - 必须说明为什么这样做，不能只说是什么
                - 必须有面试官视角的评分点和追问
                - 必须有项目表达，能让候选人迁移到真实经历
                - 避免空泛表述，例如「根据业务情况」「非常重要」「需要综合考虑」后不继续展开
                - 不确定的事实不要编造版本号、源码细节或性能数字
                """.formatted(question.getTitle(), safeCategoryName, safeDifficulty, tagText);
    }

    /**
     * 构建生成题目提示词。生成题和补答案使用相同质量门槛，避免批量生成绕过答案质量标准。
     *
     * @param req 生成请求
     * @return 可直接发送给大模型的提示词
     */
    public String buildQuestionPrompt(GenerationRequest req) {
        String safeDifficulty = textOrDefault(req.difficulty(), "MEDIUM");
        String topic = req.topic() != null && !req.topic().isBlank()
                ? "主题方向：" + req.topic()
                : "";

        return """
                请生成 %d 道 %s 面试题，难度 %s。
                %s

                ## 输出格式
                只返回 JSON 数组，不要返回 Markdown 代码围栏，不要输出额外解释。
                每个元素必须包含：
                - title: 面试题目，必须具体到一个可回答的问题，不能是宽泛主题词
                - summary: 50-120 字纯文本，给出 30 秒速览结论
                - content: Markdown，至少 500 字，必须包含「30 秒口述版」「标准答案」「面试官评分点」「高频追问」四段
                - principle: Markdown，至少 120 字，解释底层机制和关键链路
                - comparison: Markdown，至少 80 字，对比相近方案、概念或常见误解
                - scenario: Markdown，至少 80 字，说明适用场景和不适用场景
                - risk: Markdown，至少 80 字，列出线上风险、边界条件和常见坑
                - project_exp: Markdown，至少 80 字，给出可在面试中复述的项目经验表达
                - code_examples: 数组。涉及代码、SQL、算法、配置、并发、框架用法时必须至少 1 个示例；每项包含 lang、title、code、description
                - difficulty: EASY/MEDIUM/HARD

                ## 质量门槛
                - 题目之间不能重复，不能只改动几个字
                - 先给可口述答案，再展开原理，不要只堆概念
                - 必须说明为什么这样做，不能只说是什么
                - 必须有面试官视角的评分点和追问
                - 必须有项目表达，能让候选人迁移到真实经历
                - 不确定的事实不要编造版本号、源码细节或性能数字
                """.formatted(req.count(), req.category(), safeDifficulty, topic);
    }

    /**
     * 评估模型生成答案是否达到发布前最低质量门槛。
     *
     * @param question     原始题目
     * @param categoryName 分类名称
     * @param tags         标签名称列表
     * @param answer       模型返回的 JSON 对象
     * @return 质量评分和问题列表
     */
    public QualityReport evaluate(Question question, String categoryName, List<String> tags, JsonNode answer) {
        List<String> issues = new ArrayList<>();
        int score = 100;

        score -= requireLength(issues, answer.path("summary").asText(""), 40,
                "summary 摘要少于 40 字", 10);
        score -= requireLength(issues, answer.path("content").asText(""), 500,
                "content 内容少于 500 字", 30);
        score -= requireLength(issues, answer.path("principle").asText(""), 120,
                "principle 原理解析缺失或过短", 15);
        score -= requireLength(issues, answer.path("comparison").asText(""), 80,
                "comparison 对比分析缺失或过短", 8);
        score -= requireLength(issues, answer.path("scenario").asText(""), 80,
                "scenario 场景说明缺失或过短", 8);
        score -= requireLength(issues, answer.path("risk").asText(""), 80,
                "risk 风险与避坑缺失或过短", 12);
        score -= requireLength(issues, answer.path("project_exp").asText(""), 80,
                "project_exp 项目经验缺失或过短", 15);

        String content = answer.path("content").asText("");
        score -= requireNormalizedContains(issues, content, "30 秒口述版", "content 缺少 30 秒口述版", 5);
        score -= requireContains(issues, content, "标准答案", "content 缺少标准答案", 5);
        score -= requireContains(issues, content, "面试官评分点", "content 缺少面试官评分点", 5);
        score -= requireContains(issues, content, "高频追问", "content 缺少高频追问", 5);

        if (needsCodeExample(question, categoryName, tags) && !hasCodeExample(answer.path("code_examples"))) {
            issues.add("code_examples 缺少必要示例");
            score -= 10;
        }

        return new QualityReport(Math.max(0, score), List.copyOf(issues));
    }

    /**
     * 评估新生成题目是否可以进入题库草稿。
     *
     * @param categoryName 分类名称
     * @param question     模型生成的题目对象
     * @return 质量评分和问题列表
     */
    public QualityReport evaluateGeneratedQuestion(String categoryName, Question question) {
        QualityReport answerReport = evaluate(question, categoryName, List.of(), toAnswerNode(question));
        List<String> issues = new ArrayList<>(answerReport.issues());
        int score = answerReport.score();

        if (question.getTitle() == null || question.getTitle().trim().length() < 8) {
            issues.add("title 题目标题缺失或过短");
            score -= 15;
        }
        if (!VALID_DIFFICULTIES.contains(textOrDefault(question.getDifficulty(), ""))) {
            issues.add("difficulty 难度必须是 EASY/MEDIUM/HARD");
            score -= 5;
        }

        return new QualityReport(Math.max(0, score), List.copyOf(issues));
    }

    private ObjectNode toAnswerNode(Question question) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("summary", textOrDefault(question.getSummary(), ""));
        node.put("content", textOrDefault(question.getContent(), ""));
        node.put("principle", textOrDefault(question.getPrinciple(), ""));
        node.put("comparison", textOrDefault(question.getComparison(), ""));
        node.put("scenario", textOrDefault(question.getScenario(), ""));
        node.put("risk", textOrDefault(question.getRisk(), ""));
        node.put("project_exp", textOrDefault(question.getProjectExp(), ""));
        node.set("code_examples", parseCodeExamples(question.getCodeExamples()));
        return node;
    }

    private JsonNode parseCodeExamples(String codeExamples) {
        if (codeExamples == null || codeExamples.isBlank() || "null".equals(codeExamples)) {
            return objectMapper.createArrayNode();
        }
        try {
            JsonNode parsed = objectMapper.readTree(codeExamples);
            return parsed.isArray() ? parsed : objectMapper.createArrayNode();
        } catch (Exception e) {
            ArrayNode fallback = objectMapper.createArrayNode();
            return fallback;
        }
    }

    private int requireLength(List<String> issues, String value, int minLength, String issue, int penalty) {
        if (value == null || value.trim().length() < minLength) {
            issues.add(issue);
            return penalty;
        }
        return 0;
    }

    private int requireContains(List<String> issues, String value, String keyword, String issue, int penalty) {
        if (value == null || !value.contains(keyword)) {
            issues.add(issue);
            return penalty;
        }
        return 0;
    }

    private int requireNormalizedContains(List<String> issues, String value, String keyword, String issue, int penalty) {
        if (value == null || !value.replaceAll("\\s+", "").contains(keyword.replaceAll("\\s+", ""))) {
            issues.add(issue);
            return penalty;
        }
        return 0;
    }

    private boolean needsCodeExample(Question question, String categoryName, List<String> tags) {
        String text = String.join(" ",
                textOrDefault(question.getTitle(), ""),
                textOrDefault(categoryName, ""),
                tags == null ? "" : String.join(" ", tags));
        return List.of("代码", "实现", "SQL", "算法", "配置", "线程", "并发", "锁", "Spring", "MyBatis",
                        "Redis", "MySQL", "Kafka", "RabbitMQ", "Docker", "K8s", "Java")
                .stream()
                .anyMatch(text::contains);
    }

    private boolean hasCodeExample(JsonNode codeExamples) {
        if (!codeExamples.isArray() || codeExamples.isEmpty()) {
            return false;
        }
        for (JsonNode item : codeExamples) {
            if (!item.path("code").asText("").isBlank()) {
                return true;
            }
        }
        return false;
    }

    private String textOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    /**
     * AI 答案质量报告。
     *
     * @param score  质量分，0-100
     * @param issues 未达标问题列表
     */
    public record QualityReport(int score, List<String> issues) {

        /**
         * 判断答案是否达到可写入题库的最低质量门槛。
         *
         * @return true 表示通过质量门禁
         */
        public boolean passed() {
            return score >= PASS_SCORE && issues.isEmpty();
        }
    }
}
