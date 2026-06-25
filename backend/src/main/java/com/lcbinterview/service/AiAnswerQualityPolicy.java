package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.model.Question;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * AI 答案质量策略。集中维护补答案提示词模板和本地质量门禁，避免低质量回答直接写入题库。
 */
@Component
public class AiAnswerQualityPolicy {

    private static final int PASS_SCORE = 85;
    private static final Set<String> VALID_DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");
    private static final Set<String> SUPPORTED_DIAGRAM_TYPES = Set.of("mermaid", "svg", "url");
    private static final Set<String> SUPPORTED_MERMAID_STARTERS = Set.of(
            "flowchart", "graph", "sequencediagram", "classdiagram", "statediagram-v2",
            "erdiagram", "gantt", "journey", "pie", "mindmap", "timeline", "gitgraph"
    );
    private static final String MERMAID_SYNTAX_GUARDRAILS = """

            ## Mermaid 图解语法约束
            - diagrams[].content 必须是合法 Mermaid 源码，content 不要包含 ```mermaid 代码围栏。
            - flowchart 节点必须使用 A[\"文本\"] 或 B{\"判断文本\"} 格式，节点 ID 只能使用英文字母、数字和下划线。
            - 节点文本包含中文、括号、冒号、斜杠、逗号时，必须放在双引号里。
            - Mermaid 示例：
              flowchart TD
                A[\"开始排序查询\"] --> B{\"是否命中索引排序？\"}
                B -->|是| C[\"按索引顺序扫描\"]
                B -->|否| D[\"执行 filesort\"]
            """;
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
                - diagrams: 数组，必须至少 1 个图解；每项包含 type、alt、content、caption。type 优先使用 mermaid，content 只放 Mermaid 源码，不要 Markdown 代码围栏
                - difficulty: EASY/MEDIUM/HARD

                ## 质量门槛
                - 先给可口述的答案，再展开原理，不要只堆概念
                - 必须说明为什么这样做，不能只说是什么
                - 必须有面试官视角的评分点和追问
                - 必须有项目表达，能让候选人迁移到真实经历
                - 必须提供一张能帮助快速理解的流程图、时序图或结构图；优先用 Mermaid flowchart/sequenceDiagram/classDiagram
                - 避免空泛表述，例如「根据业务情况」「非常重要」「需要综合考虑」后不继续展开
                - 不确定的事实不要编造版本号、源码细节或性能数字
                """.formatted(question.getTitle(), safeCategoryName, safeDifficulty, tagText)
                + MERMAID_SYNTAX_GUARDRAILS;
    }

    /**
     * 构建已发布题目答案重写提示词。提示词带上旧答案上下文，方便新模型保留题意但完整重写表达。
     *
     * @param question     已发布题目
     * @param categoryName 分类名称
     * @param tags         标签名称列表
     * @return 可直接发送给大模型的重写提示词
     */
    public String buildRewritePrompt(Question question, String categoryName, List<String> tags) {
        String safeCategoryName = textOrDefault(categoryName, "未知分类");
        String safeDifficulty = textOrDefault(question.getDifficulty(), "MEDIUM");
        String tagText = tags == null || tags.isEmpty() ? "无" : String.join("、", tags);
        String currentAnswer = textOrDefault(question.getContent(), textOrDefault(question.getAnswer(), "无"));

        return """
                请为下面这道已发布题目完整重写一份可审核的新答案。不要只局部补丁，要以新模型能力重新组织表达。

                ## 已发布题目上下文
                题目：%s
                分类：%s
                难度：%s
                标签：%s

                ## 当前已发布答案
                %s

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
                - diagrams: 数组，必须至少 1 个图解；每项包含 type、alt、content、caption。type 优先使用 mermaid，content 只放 Mermaid 源码，不要 Markdown 代码围栏
                - difficulty: EASY/MEDIUM/HARD

                ## 质量门槛
                - 保持原题题意，不要改题目方向
                - 先给可口述的答案，再展开原理，不要只堆概念
                - 必须说明为什么这样做，不能只说是什么
                - 必须有面试官视角的评分点和追问
                - 必须有项目表达，能让候选人迁移到真实经历
                - 必须提供一张能帮助快速理解的流程图、时序图或结构图；优先用 Mermaid flowchart/sequenceDiagram/classDiagram
                - 不确定的事实不要编造版本号、源码细节或性能数字
                """.formatted(question.getTitle(), safeCategoryName, safeDifficulty, tagText, currentAnswer)
                + MERMAID_SYNTAX_GUARDRAILS;
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
                - diagrams: 数组，必须至少 1 个图解；每项包含 type、alt、content、caption。type 优先使用 mermaid，content 只放 Mermaid 源码，不要 Markdown 代码围栏
                - difficulty: EASY/MEDIUM/HARD

                ## 质量门槛
                - 题目之间不能重复，不能只改动几个字
                - 先给可口述答案，再展开原理，不要只堆概念
                - 必须说明为什么这样做，不能只说是什么
                - 必须有面试官视角的评分点和追问
                - 必须有项目表达，能让候选人迁移到真实经历
                - 必须提供一张能帮助快速理解的流程图、时序图或结构图；优先用 Mermaid flowchart/sequenceDiagram/classDiagram
                - 不确定的事实不要编造版本号、源码细节或性能数字
                """.formatted(req.count(), req.category(), safeDifficulty, topic)
                + MERMAID_SYNTAX_GUARDRAILS;
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
        score -= requireValidDiagram(issues, answer.path("diagrams"));

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
        node.set("diagrams", parseJsonArray(question.getDiagrams()));
        return node;
    }

    private JsonNode parseCodeExamples(String codeExamples) {
        return parseJsonArray(codeExamples);
    }

    private JsonNode parseJsonArray(String value) {
        if (value == null || value.isBlank() || "null".equals(value)) {
            return objectMapper.createArrayNode();
        }
        try {
            JsonNode parsed = objectMapper.readTree(value);
            return parsed.isArray() ? parsed : objectMapper.createArrayNode();
        } catch (Exception e) {
            return objectMapper.createArrayNode();
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

    private int requireValidDiagram(List<String> issues, JsonNode diagrams) {
        if (!diagrams.isArray() || diagrams.isEmpty()) {
            issues.add("diagrams 缺少图解");
            return 6;
        }

        int before = issues.size();
        boolean hasValidDiagram = false;
        for (JsonNode item : diagrams) {
            String issue = validateDiagramItem(item);
            if (issue == null) {
                hasValidDiagram = true;
            } else {
                issues.add(issue);
            }
        }
        if (!hasValidDiagram) {
            issues.add("diagrams 缺少可渲染图解");
        }
        return issues.size() > before ? 10 : 0;
    }

    private String validateDiagramItem(JsonNode item) {
        String type = item.path("type").asText("").trim();
        String content = item.path("content").asText("").trim();
        if (type.isBlank() || content.isBlank()) {
            return "diagrams 图解类型或内容为空";
        }

        String normalizedType = type.toLowerCase(Locale.ROOT);
        if (!type.equals(normalizedType) && SUPPORTED_DIAGRAM_TYPES.contains(normalizedType)) {
            return "diagrams 图解类型必须使用小写：" + type;
        }
        if (!SUPPORTED_DIAGRAM_TYPES.contains(type)) {
            return "diagrams 图解类型不支持：" + type;
        }
        if ("mermaid".equals(type)) {
            return validateMermaidContent(content);
        }
        return null;
    }

    private String validateMermaidContent(String content) {
        if (content.contains("```")) {
            return "diagrams Mermaid 源码不能包含 Markdown 代码围栏";
        }

        String firstLine = firstMermaidContentLine(content);
        if (firstLine == null || !isSupportedMermaidStarter(firstLine)) {
            return "diagrams Mermaid 图解必须以合法图表类型开头";
        }
        if (isFlowchart(firstLine)) {
            return validateFlowchartLabels(content);
        }
        return null;
    }

    private String firstMermaidContentLine(String content) {
        for (String line : content.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isBlank() || trimmed.startsWith("%%")) {
                continue;
            }
            if (!trimmed.isBlank()) {
                return trimmed;
            }
        }
        return null;
    }

    private boolean isSupportedMermaidStarter(String firstLine) {
        String normalized = firstLine.toLowerCase(Locale.ROOT);
        return SUPPORTED_MERMAID_STARTERS.stream()
                .anyMatch(starter -> normalized.equals(starter) || normalized.startsWith(starter + " "));
    }

    private boolean isFlowchart(String firstLine) {
        String normalized = firstLine.toLowerCase(Locale.ROOT);
        return normalized.equals("flowchart")
                || normalized.startsWith("flowchart ")
                || normalized.equals("graph")
                || normalized.startsWith("graph ");
    }

    private String validateFlowchartLabels(String content) {
        for (String line : content.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isBlank() || trimmed.startsWith("%%")) {
                continue;
            }
            String issue = validateFlowchartLabelsInLine(line);
            if (issue != null) {
                return issue;
            }
        }
        return null;
    }

    private String validateFlowchartLabelsInLine(String line) {
        for (int i = 0; i < line.length(); i++) {
            char current = line.charAt(i);
            if (current != '[' && current != '{' && current != '(' && current != '>') {
                continue;
            }
            if (!isNodeLabelStart(line, i)) {
                continue;
            }

            int closeIndex = findFlowchartLabelClose(line, i, current);
            if (closeIndex < 0) {
                return "diagrams Mermaid flowchart 节点括号未闭合";
            }
            int labelStart = current == '(' && i + 1 < line.length() && line.charAt(i + 1) == '('
                    ? i + 2
                    : i + 1;
            String label = line.substring(labelStart, closeIndex).trim();
            if (!isQuotedLabel(label)) {
                return "diagrams Mermaid flowchart 节点文本必须使用双引号";
            }
            i = current == '(' && closeIndex + 1 < line.length() && line.charAt(closeIndex + 1) == ')'
                    ? closeIndex + 1
                    : closeIndex;
        }
        return null;
    }

    private int findFlowchartLabelClose(String line, int openIndex, char open) {
        if (open == '(' && openIndex + 1 < line.length() && line.charAt(openIndex + 1) == '(') {
            return findDoubleRoundClose(line, openIndex + 2);
        }
        char close = switch (open) {
            case '[' -> ']';
            case '{' -> '}';
            case '>' -> ']';
            default -> ')';
        };
        return findCloseOutsideQuotes(line, openIndex + 1, close);
    }

    private int findDoubleRoundClose(String line, int startIndex) {
        boolean inQuotes = false;
        for (int i = startIndex; i < line.length() - 1; i++) {
            char current = line.charAt(i);
            if (current == '"' && (i == 0 || line.charAt(i - 1) != '\\')) {
                inQuotes = !inQuotes;
            }
            if (!inQuotes && current == ')' && line.charAt(i + 1) == ')') {
                return i;
            }
        }
        return -1;
    }

    private int findCloseOutsideQuotes(String line, int startIndex, char close) {
        boolean inQuotes = false;
        for (int i = startIndex; i < line.length(); i++) {
            char current = line.charAt(i);
            if (current == '"' && (i == 0 || line.charAt(i - 1) != '\\')) {
                inQuotes = !inQuotes;
            }
            if (!inQuotes && current == close) {
                return i;
            }
        }
        return -1;
    }

    private boolean isNodeLabelStart(String line, int openIndex) {
        int cursor = openIndex - 1;
        while (cursor >= 0 && Character.isWhitespace(line.charAt(cursor))) {
            cursor--;
        }
        if (cursor < 0) {
            return false;
        }
        char previous = line.charAt(cursor);
        return Character.isLetterOrDigit(previous) || previous == '_';
    }

    private boolean isQuotedLabel(String label) {
        return label.length() >= 2 && label.startsWith("\"") && label.endsWith("\"");
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
