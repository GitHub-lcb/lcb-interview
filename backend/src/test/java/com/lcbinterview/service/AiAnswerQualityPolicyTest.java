package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI 答案质量策略测试，约束补答案 prompt 和本地质量门禁。
 */
class AiAnswerQualityPolicyTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AiAnswerQualityPolicy policy = new AiAnswerQualityPolicy();

    @Test
    void buildFillPromptIncludesQuestionContextAndQualityRubric() {
        Question question = question();

        String prompt = policy.buildFillPrompt(question, "Java 并发", List.of("线程池", "并发"));

        assertThat(prompt)
                .contains("题目：线程池参数如何配置？")
                .contains("分类：Java 并发")
                .contains("难度：HARD")
                .contains("标签：线程池、并发")
                .contains("30 秒口述版")
                .contains("面试官评分点")
                .contains("diagrams")
                .contains("质量门槛")
                .contains("避免空泛表述");
    }

    @Test
    void buildRewritePromptIncludesExistingPublishedAnswerContext() {
        Question question = question();
        question.setSummary("旧摘要");
        question.setContent("旧答案内容，需要被新模型完整改写。");
        question.setPrinciple("旧原理");

        String prompt = policy.buildRewritePrompt(question, "Java 并发", List.of("线程池"));

        assertThat(prompt)
                .contains("完整重写")
                .contains("已发布题目")
                .contains("旧答案内容，需要被新模型完整改写。")
                .contains("只返回 JSON 对象")
                .contains("质量门槛")
                .contains("不要只局部补丁");
    }

    @Test
    void buildQuestionPromptUsesSameQualityRubricForGeneratedQuestions() {
        GenerationRequest request = new GenerationRequest("Java 并发", "HARD", 3, "线程池参数配置");

        String prompt = policy.buildQuestionPrompt(request);

        assertThat(prompt)
                .contains("请生成 3 道 Java 并发 面试题")
                .contains("难度 HARD")
                .contains("主题方向：线程池参数配置")
                .contains("30 秒口述版")
                .contains("标准答案")
                .contains("面试官评分点")
                .contains("高频追问")
                .contains("diagrams")
                .contains("质量门槛");
    }

    @Test
    void buildPromptsIncludeMermaidSyntaxGuardrails() {
        Question question = question();
        GenerationRequest request = new GenerationRequest("Java 并发", "HARD", 1, "线程池参数配置");

        assertThat(policy.buildFillPrompt(question, "Java 并发", List.of("线程池")))
                .contains("flowchart 节点必须使用 A[\"文本\"] 或 B{\"判断文本\"} 格式")
                .contains("节点文本包含中文、括号、冒号、斜杠、逗号时，必须放在双引号里");
        assertThat(policy.buildRewritePrompt(question, "Java 并发", List.of("线程池")))
                .contains("flowchart 节点必须使用 A[\"文本\"] 或 B{\"判断文本\"} 格式")
                .contains("content 不要包含 ```mermaid 代码围栏");
        assertThat(policy.buildQuestionPrompt(request))
                .contains("flowchart TD")
                .contains("A[\"开始排序查询\"] --> B{\"是否命中索引排序？\"}");
    }

    @Test
    void evaluateRejectsShallowGeneratedAnswer() throws Exception {
        Question question = question();
        JsonNode answer = objectMapper.readTree("""
                {
                  "summary": "线程池参数要结合业务配置。",
                  "content": "线程池很重要，实际开发中要根据业务情况合理配置。",
                  "principle": "",
                  "comparison": null,
                  "scenario": null,
                  "risk": null,
                  "project_exp": null,
                  "code_examples": [],
                  "diagrams": []
                }
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.passed()).isFalse();
        assertThat(report.score()).isLessThan(85);
        assertThat(report.issues()).contains("content 内容少于 500 字");
        assertThat(report.issues()).contains("principle 原理解析缺失或过短");
        assertThat(report.issues()).contains("project_exp 项目经验缺失或过短");
    }

    @Test
    void evaluateAcceptsStructuredHighQualityAnswer() throws Exception {
        Question question = question();
        JsonNode answer = objectMapper.readTree("""
                {
                  "summary": "线程池参数配置要从任务类型、吞吐量、延迟目标和系统资源出发，先确定核心线程、队列和拒绝策略，再通过压测验证。",
                  "content": "## 30 秒口述版\\n线程池不是简单把 corePoolSize 调大，而是先判断任务是 CPU 密集还是 I/O 密集，再结合 QPS、平均耗时、峰值流量和机器资源估算并发量。配置时重点看核心线程数、最大线程数、队列长度、拒绝策略和线程命名。线上必须配监控，观察活跃线程、队列堆积、拒绝次数和任务耗时，再通过压测迭代。\\n\\n## 标准答案\\n第一步判断任务类型。CPU 密集任务线程数通常接近 CPU 核数，避免上下文切换；I/O 密集任务可以适当放大，因为线程经常等待外部资源。第二步根据 Little 定律估算并发量，例如并发量约等于 QPS 乘以平均响应时间。第三步选择队列策略，有界队列能保护系统，不能使用无界队列掩盖堆积。第四步设置拒绝策略，核心链路通常要降级、限流或返回明确错误，不能静默丢任务。第五步上线后持续观察指标，并根据压测结果调整。\\n\\n## 面试官评分点\\n能说清任务类型、容量估算、队列选择、拒绝策略、监控压测和降级方案，说明不是背参数，而是知道生产配置方法。\\n\\n## 高频追问\\n如果队列已经堆积但 CPU 不高，应该优先排查下游耗时、锁竞争或连接池瓶颈，而不是盲目增加线程。为什么不能用无界队列？因为最大线程数可能永远不会生效，内存会被堆积任务拖垮。",
                  "principle": "ThreadPoolExecutor 的执行流程是先尝试创建核心线程，核心线程满后任务进入阻塞队列，队列满后再尝试创建非核心线程，达到最大线程数后触发拒绝策略。因此 corePoolSize、workQueue 和 maximumPoolSize 是联动关系，不是孤立参数。队列越长，削峰能力越强，但延迟越高；线程越多，并发处理能力可能提高，但上下文切换和资源竞争也会上升。",
                  "comparison": "固定线程池适合稳定负载，但无界队列风险高；缓存线程池弹性强，但高峰期可能创建过多线程；自定义 ThreadPoolExecutor 可以显式设置有界队列、命名线程、拒绝策略和监控指标，更适合生产业务。",
                  "scenario": "适合异步通知、批量导入、报表生成、消息消费等可异步处理的任务。对于支付扣款、库存扣减等强一致链路，需要谨慎使用异步线程池，并补充幂等、补偿和告警。如果下游服务不稳定，还要配合限流、熔断和重试退避，避免线程池把故障进一步放大。",
                  "risk": "常见坑包括使用 Executors.newFixedThreadPool 导致无界队列堆积、拒绝策略使用 DiscardPolicy 静默丢任务、线程池被多个业务混用导致互相拖垮、只配置参数不做监控。生产上应使用独立线程池隔离业务，并记录拒绝次数和队列长度。",
                  "project_exp": "在订单超时取消项目中，我会把扫描任务和通知任务拆成两个线程池。扫描线程池控制数据库分页读取并发，通知线程池处理 MQ 或 HTTP 调用。队列设置为有界容量，拒绝时写入补偿表并打告警。上线前用压测模拟峰值订单量，观察队列长度、P95 耗时和拒绝次数，避免高峰期把数据库连接池打满。",
                  "code_examples": [
                    {
                      "lang": "java",
                      "title": "生产线程池配置示例",
                      "code": "new ThreadPoolExecutor(8, 16, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(500), namedFactory, new ThreadPoolExecutor.CallerRunsPolicy());",
                      "description": "使用有界队列和明确拒绝策略，避免任务无限堆积。"
                    }
                  ],
                  "diagrams": [
                    {
                      "type": "mermaid",
                      "alt": "线程池执行流程",
                      "content": "flowchart LR\\nA[\\\"提交任务\\\"] --> B{\\\"核心线程未满?\\\"}\\nB -- 是 --> C[\\\"创建核心线程\\\"]\\nB -- 否 --> D{\\\"队列未满?\\\"}\\nD -- 是 --> E[\\\"进入有界队列\\\"]\\nD -- 否 --> F{\\\"最大线程未满?\\\"}\\nF -- 是 --> G[\\\"创建非核心线程\\\"]\\nF -- 否 --> H[\\\"触发拒绝策略\\\"]",
                      "caption": "展示 ThreadPoolExecutor 从提交任务到拒绝策略的关键分支。"
                    }
                  ]
                }
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.score()).isGreaterThanOrEqualTo(85);
        assertThat(report.issues()).isEmpty();
        assertThat(report.passed()).isTrue();
    }

    @Test
    void evaluateAcceptsCompactOralSectionTitle() throws Exception {
        Question question = question();
        JsonNode answer = objectMapper.readTree("""
                {
                  "summary": "线程池参数配置要从任务类型、吞吐量、延迟目标和系统资源出发，先确定核心线程、队列和拒绝策略，再通过压测验证。",
                  "content": "## 30秒口述版\\n线程池配置不能只看核心线程数，要先判断任务是 CPU 密集还是 I/O 密集，再结合 QPS、平均耗时、机器 CPU 核数和下游容量估算并发。生产里我会重点控制核心线程数、最大线程数、队列长度和拒绝策略，并配合监控观察队列堆积、拒绝次数、任务耗时。\\n\\n## 标准答案\\nCPU 密集任务线程数通常接近 CPU 核数，避免上下文切换；I/O 密集任务可以适当放大，因为线程经常等待外部资源。队列必须有界，不能使用无界队列掩盖堆积。拒绝策略不能静默丢任务，核心链路要降级、限流或返回明确错误。配置后还要通过压测验证峰值流量下的队列长度、P95 耗时和拒绝次数。如果任务是调用外部 HTTP、数据库或 MQ，下游连接池容量也要纳入估算，否则线程开多了只会把瓶颈转移到下游。\\n\\n## 面试官评分点\\n能说清任务类型、容量估算、队列选择、拒绝策略、监控压测和降级方案，说明不是背参数，而是知道生产配置方法。优秀回答还会主动提到线程隔离、任务超时、上下文传递、异常告警和灰度压测。\\n\\n## 高频追问\\n如果队列已经堆积但 CPU 不高，应该优先排查下游耗时、锁竞争或连接池瓶颈，而不是盲目增加线程。为什么不能用无界队列？因为最大线程数可能永远不会生效，内存会被堆积任务拖垮。如何处理拒绝？核心链路可以限流或返回明确错误，异步链路可以写补偿表并由后台任务重试。",
                  "principle": "ThreadPoolExecutor 的执行流程是先尝试创建核心线程，核心线程满后任务进入阻塞队列，队列满后再尝试创建非核心线程，达到最大线程数后触发拒绝策略。因此 corePoolSize、workQueue 和 maximumPoolSize 是联动关系，不是孤立参数。队列越长，削峰能力越强，但延迟越高；线程越多，并发处理能力可能提高，但上下文切换和资源竞争也会上升。",
                  "comparison": "固定线程池适合稳定负载，但无界队列风险高；缓存线程池弹性强，但高峰期可能创建过多线程；自定义 ThreadPoolExecutor 可以显式设置有界队列、命名线程、拒绝策略和监控指标，更适合生产业务。",
                  "scenario": "适合异步通知、批量导入、报表生成、消息消费等可异步处理的任务。对于支付扣款、库存扣减等强一致链路，需要谨慎使用异步线程池，并补充幂等、补偿和告警。如果下游服务不稳定，还要配合限流、熔断和重试退避，避免线程池把故障进一步放大。",
                  "risk": "常见坑包括使用 Executors.newFixedThreadPool 导致无界队列堆积、拒绝策略使用 DiscardPolicy 静默丢任务、线程池被多个业务混用导致互相拖垮、只配置参数不做监控。生产上应使用独立线程池隔离业务，并记录拒绝次数和队列长度。",
                  "project_exp": "在订单超时取消项目中，我会把扫描任务和通知任务拆成两个线程池。扫描线程池控制数据库分页读取并发，通知线程池处理 MQ 或 HTTP 调用。队列设置为有界容量，拒绝时写入补偿表并打告警。上线前用压测模拟峰值订单量，观察队列长度、P95 耗时和拒绝次数，避免高峰期把数据库连接池打满。",
                  "code_examples": [
                    {
                      "lang": "java",
                      "title": "生产线程池配置示例",
                      "code": "new ThreadPoolExecutor(8, 16, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(500), namedFactory, new ThreadPoolExecutor.CallerRunsPolicy());",
                      "description": "使用有界队列和明确拒绝策略，避免任务无限堆积。"
                    }
                  ],
                  "diagrams": [
                    {
                      "type": "mermaid",
                      "alt": "线程池执行流程",
                      "content": "flowchart LR\\nA[\\\"提交任务\\\"] --> B{\\\"核心线程未满?\\\"}\\nB -- 是 --> C[\\\"创建核心线程\\\"]\\nB -- 否 --> D{\\\"队列未满?\\\"}\\nD -- 是 --> E[\\\"进入有界队列\\\"]\\nD -- 否 --> F{\\\"最大线程未满?\\\"}\\nF -- 是 --> G[\\\"创建非核心线程\\\"]\\nF -- 否 --> H[\\\"触发拒绝策略\\\"]",
                      "caption": "展示 ThreadPoolExecutor 从提交任务到拒绝策略的关键分支。"
                    }
                  ]
                }
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.issues()).doesNotContain("content 缺少 30 秒口述版");
        assertThat(report.passed()).isTrue();
    }

    @Test
    void evaluateGeneratedQuestionRejectsWeakQuestionBeforeSaving() {
        Question generated = new Question();
        generated.setTitle("线程池");
        generated.setDifficulty("UNKNOWN");
        generated.setSummary("线程池很重要。");
        generated.setContent("根据业务情况合理配置线程池。");
        generated.setPrinciple("");
        generated.setComparison("");
        generated.setScenario("");
        generated.setRisk("");
        generated.setProjectExp("");
        generated.setCodeExamples("[]");
        generated.setDiagrams("[]");

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluateGeneratedQuestion("Java 并发", generated);

        assertThat(report.passed()).isFalse();
        assertThat(report.score()).isLessThan(85);
        assertThat(report.issues()).contains("title 题目标题缺失或过短");
        assertThat(report.issues()).contains("difficulty 难度必须是 EASY/MEDIUM/HARD");
        assertThat(report.issues()).contains("content 内容少于 500 字");
    }

    @Test
    void evaluateRejectsMermaidFlowchartNodeTextWithoutQuotes() {
        Question question = question();
        JsonNode answer = highQualityAnswerWithDiagram("""
                flowchart TD
                A[开始排序查询] --> B{是否使用索引排序?}
                B -- 否 --> E[filesort]
                E --> F[构造排序元组(包含排序键和行数据/主键)]
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.passed()).isFalse();
        assertThat(report.issues()).contains("diagrams Mermaid flowchart 节点文本必须使用双引号");
    }

    @Test
    void evaluateRejectsDiagramTypeThatIsNotLowercase() {
        Question question = question();
        JsonNode answer = highQualityAnswerWithDiagram("Mermaid", validQuotedFlowchart());

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.passed()).isFalse();
        assertThat(report.issues()).contains("diagrams 图解类型必须使用小写：Mermaid");
    }

    @Test
    void evaluateRejectsMermaidRoundNodeTextWithoutQuotes() {
        Question question = question();
        JsonNode answer = highQualityAnswerWithDiagram("""
                flowchart TD
                A[\"开始排序查询\"] --> B(构造排序元组(包含排序键和行数据/主键))
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.passed()).isFalse();
        assertThat(report.issues()).contains("diagrams Mermaid flowchart 节点文本必须使用双引号");
    }

    @Test
    void evaluateRejectsMermaidAsymmetricNodeTextWithoutQuotes() {
        Question question = question();
        JsonNode answer = highQualityAnswerWithDiagram("""
                flowchart TD
                A[\"开始排序查询\"] --> B>行数据/主键]
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.passed()).isFalse();
        assertThat(report.issues()).contains("diagrams Mermaid flowchart 节点文本必须使用双引号");
    }

    @Test
    void evaluateAcceptsMermaidFlowchartWithLeadingComment() {
        Question question = question();
        JsonNode answer = highQualityAnswerWithDiagram("""
                %% 排序流程
                flowchart TD
                A[\"开始排序查询\"] --> B{\"是否命中索引排序？\"}
                B -->|否| C[\"执行 filesort\"]
                """);

        AiAnswerQualityPolicy.QualityReport report =
                policy.evaluate(question, "Java 并发", List.of("线程池", "并发"), answer);

        assertThat(report.issues()).isEmpty();
        assertThat(report.passed()).isTrue();
    }

    private Question question() {
        Question question = new Question();
        question.setTitle("线程池参数如何配置？");
        question.setDifficulty("HARD");
        return question;
    }

    private String validQuotedFlowchart() {
        return """
                flowchart TD
                A[\"开始排序查询\"] --> B{\"是否命中索引排序？\"}
                B -->|否| C[\"执行 filesort\"]
                """;
    }

    private JsonNode highQualityAnswerWithDiagram(String diagramContent) {
        return highQualityAnswerWithDiagram("mermaid", diagramContent);
    }

    private JsonNode highQualityAnswerWithDiagram(String diagramType, String diagramContent) {
        var root = objectMapper.createObjectNode();
        root.put("summary", "线程池参数配置要从任务类型、吞吐量、延迟目标和系统资源出发，先确定核心线程、队列和拒绝策略，再通过压测验证。");
        root.put("content", "## 30 秒口述版\n线程池配置不能只看核心线程数，要先判断任务是 CPU 密集还是 I/O 密集，再结合 QPS、平均耗时、机器 CPU 核数和下游容量估算并发。生产里我会重点控制核心线程数、最大线程数、队列长度和拒绝策略，并配合监控观察队列堆积、拒绝次数、任务耗时。\n\n## 标准答案\nCPU 密集任务线程数通常接近 CPU 核数，避免上下文切换；I/O 密集任务可以适当放大，因为线程经常等待外部资源。队列必须有界，不能使用无界队列掩盖堆积。拒绝策略不能静默丢任务，核心链路要降级、限流或返回明确错误。配置后还要通过压测验证峰值流量下的队列长度、P95 耗时和拒绝次数。如果任务是调用外部 HTTP、数据库或 MQ，下游连接池容量也要纳入估算，否则线程开多了只会把瓶颈转移到下游。\n\n## 面试官评分点\n能说清任务类型、容量估算、队列选择、拒绝策略、监控压测和降级方案，说明不是背参数，而是知道生产配置方法。优秀回答还会主动提到线程隔离、任务超时、上下文传递、异常告警和灰度压测。\n\n## 高频追问\n如果队列已经堆积但 CPU 不高，应该优先排查下游耗时、锁竞争或连接池瓶颈，而不是盲目增加线程。为什么不能用无界队列？因为最大线程数可能永远不会生效，内存会被堆积任务拖垮。如何处理拒绝？核心链路可以限流或返回明确错误，异步链路可以写补偿表并由后台任务重试。");
        root.put("principle", "ThreadPoolExecutor 的执行流程是先尝试创建核心线程，核心线程满后任务进入阻塞队列，队列满后再尝试创建非核心线程，达到最大线程数后触发拒绝策略。因此 corePoolSize、workQueue 和 maximumPoolSize 是联动关系，不是孤立参数。队列越长，削峰能力越强，但延迟越高；线程越多，并发处理能力可能提高，但上下文切换和资源竞争也会上升。");
        root.put("comparison", "固定线程池适合稳定负载，但无界队列风险高；缓存线程池弹性强，但高峰期可能创建过多线程；自定义 ThreadPoolExecutor 可以显式设置有界队列、命名线程、拒绝策略和监控指标，更适合生产业务。");
        root.put("scenario", "适合异步通知、批量导入、报表生成、消息消费等可异步处理的任务。对于支付扣款、库存扣减等强一致链路，需要谨慎使用异步线程池，并补充幂等、补偿和告警。如果下游服务不稳定，还要配合限流、熔断和重试退避，避免线程池把故障进一步放大。");
        root.put("risk", "常见坑包括使用 Executors.newFixedThreadPool 导致无界队列堆积、拒绝策略使用 DiscardPolicy 静默丢任务、线程池被多个业务混用导致互相拖垮、只配置参数不做监控。生产上应使用独立线程池隔离业务，并记录拒绝次数和队列长度。");
        root.put("project_exp", "在订单超时取消项目中，我会把扫描任务和通知任务拆成两个线程池。扫描线程池控制数据库分页读取并发，通知线程池处理 MQ 或 HTTP 调用。队列设置为有界容量，拒绝时写入补偿表并打告警。上线前用压测模拟峰值订单量，观察队列长度、P95 耗时和拒绝次数，避免高峰期把数据库连接池打满。");

        var codeExamples = objectMapper.createArrayNode();
        var codeExample = objectMapper.createObjectNode();
        codeExample.put("lang", "java");
        codeExample.put("title", "生产线程池配置示例");
        codeExample.put("code", "new ThreadPoolExecutor(8, 16, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(500), namedFactory, new ThreadPoolExecutor.CallerRunsPolicy());");
        codeExample.put("description", "使用有界队列和明确拒绝策略，避免任务无限堆积。");
        codeExamples.add(codeExample);
        root.set("code_examples", codeExamples);

        var diagrams = objectMapper.createArrayNode();
        var diagram = objectMapper.createObjectNode();
        diagram.put("type", diagramType);
        diagram.put("alt", "线程池执行流程");
        diagram.put("content", diagramContent);
        diagram.put("caption", "展示关键分支。");
        diagrams.add(diagram);
        root.set("diagrams", diagrams);
        return root;
    }
}
