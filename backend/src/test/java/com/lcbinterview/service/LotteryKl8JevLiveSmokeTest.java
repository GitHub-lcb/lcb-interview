package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

import java.io.IOException;
import java.lang.reflect.Method;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Jev 真实端点冒烟测试。
 *
 * 与其余 Jev 测试的区别：本测试会真的访问 api.typesafe.ai 并产生费用，
 * 因此默认跳过，只有同时满足两个条件才执行：
 * <ol>
 *   <li>环境变量 {@code JEV_LIVE_TEST=true}；</li>
 *   <li>能拿到密钥：{@code TYPESAFE_API_KEY}，或由 {@code JEV_KEY_FILE} 指定的密钥文件
 *       （默认 {@code .jev-key}，已加入 .gitignore）。</li>
 * </ol>
 *
 * 它解决的是接入后唯一无法用桩验证的缺口：真实响应的字段名是否与解析代码一致。
 * 若字段名对不上，解析会静默退避到 25% 基线，表面上像「没有信号」，实际是解析失败。
 *
 * 结果同时写入 {@code target/jev-smoke-report.txt}（可用 {@code JEV_SMOKE_REPORT} 覆盖），
 * 便于在非交互环境下取回原始响应。
 */
class LotteryKl8JevLiveSmokeTest {

    /** 默认密钥文件，相对 backend 模块根目录。 */
    private static final String DEFAULT_KEY_FILE = ".jev-key";

    /** 默认报告路径，相对 backend 模块根目录。 */
    private static final String DEFAULT_REPORT = "target/jev-smoke-report.txt";

    /** 真实调用超时，比常规调用放宽，避免冷启动被判超时。 */
    private static final long LIVE_TIMEOUT_MS = 60_000L;

    /** 合成历史期数：够撑起 30/60 期窗口，又不必真的攒数据。 */
    private static final int SYNTHETIC_DRAWS = 90;

    /** 冒烟统一使用的选号数量。 */
    private static final int ESTIMATE_PICK_SIZE = 4;

    /** 重复性检验的调用次数。 */
    private static final int REPEAT_RUNS = 3;

    private String apiKey;
    private String endpoint;
    private StringBuilder report;
    private Path reportPath;

    @BeforeEach
    void prepareLiveRun(TestInfo testInfo) {
        assumeTrue("true".equalsIgnoreCase(env("JEV_LIVE_TEST")),
                "未设置 JEV_LIVE_TEST=true，跳过真实端点冒烟");
        apiKey = resolveApiKey();
        assumeTrue(!apiKey.isBlank(),
                "未提供 TYPESAFE_API_KEY 或密钥文件，跳过真实端点冒烟");
        endpoint = hasText(env("JEV_URL")) ? env("JEV_URL") : JevRuntimeConfig.DEFAULT_API_URL;
        // 报告按测试方法分文件。两个测试若写同一路径，后跑的会覆盖先跑的，
        // 上一版就因此丢掉了「字段核对」那一份原始响应——而原始响应恰恰是本次冒烟最该留下的证据。
        String base = hasText(env("JEV_SMOKE_REPORT")) ? env("JEV_SMOKE_REPORT") : DEFAULT_REPORT;
        String method = testInfo.getTestMethod().map(Method::getName).orElse("unknown");
        reportPath = Path.of(base.replaceFirst("\\.txt$", "") + "-" + method + ".txt");
        report = new StringBuilder();
        report.append("=== Jev 真实端点冒烟 ===\n");
        report.append("测试方法: ").append(method).append('\n');
        report.append("endpoint: ").append(endpoint).append('\n');
        report.append("api_key : ").append(mask(apiKey)).append('\n');
    }

    @AfterEach
    void writeReport() throws IOException {
        if (report == null || reportPath == null) {
            return;
        }
        if (reportPath.getParent() != null) {
            Files.createDirectories(reportPath.getParent());
        }
        Files.writeString(reportPath, report.toString(), StandardCharsets.UTF_8);
    }

    @Test
    void probesRealResponseFieldNames() throws Exception {
        JevPromptRenderer renderer = new JevPromptRenderer(JevPromptLocale.ZH);
        LotteryKl8JevClient client = new LotteryKl8JevClient(new ObjectMapper(), config(JevPromptLocale.ZH));

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("schema_note", renderer.schemaNote());
        state.put("game", renderer.gameName());
        state.put("play_mode", renderer.playMode(4));
        state.put("theoretical_single_number_probability", 0.25);
        state.put("recent_numbers", List.of(3, 11, 17, 24, 29, 33, 38, 41, 45, 52, 57, 61, 66, 70, 73, 76, 78, 79, 80, 9));

        List<JevQuestion> questions = List.of(
                JevQuestion.noul("probe_noul", renderer.numberInstruction(37), renderer.numberCriteria()),
                JevQuestion.choice("probe_choice", "这组号码的结构更接近哪一类？",
                        Map.of("balanced", "区间、奇偶、尾数分布均衡",
                                "skewed", "存在明显的区间或奇偶集中")),
                JevQuestion.score("probe_score", renderer.riskInstruction(4), renderer.riskLevels()));

        String requestBody = client.serializeRequest(config(JevPromptLocale.ZH).current().model(), state, questions);
        HttpResponse<String> response = sendRaw(requestBody);

        report.append("\n--- [1] 请求体 ---\n").append(requestBody).append('\n');
        report.append("\n--- [1] 原始响应 (HTTP ").append(response.statusCode()).append(") ---\n")
                .append(response.body()).append('\n');

        assumeTrue(response.statusCode() == 200,
                "端点返回 HTTP " + response.statusCode() + "，跳过字段核对：" + response.body());
        assertTrue(response.body().contains("\"answers\""),
                "响应缺少顶层 answers 字段，解析代码需要调整");

        JevEvaluation evaluation = client.parseResponse(response.body(), 0L);
        JevAnswer noul = evaluation.answer("probe_noul");
        JevAnswer choice = evaluation.answer("probe_choice");
        JevAnswer score = evaluation.answer("probe_score");

        report.append("\n--- [1] 字段核对 ---\n");
        report.append("model          : ").append(evaluation.model()).append('\n');
        report.append("answers 数量    : ").append(evaluation.answers().size()).append('\n');
        report.append("usage 输入 token: ").append(evaluation.inputTokens()).append('\n');
        report.append("usage 输出 token: ").append(evaluation.outputTokens()).append('\n');
        report.append("noul 解析       : ").append(describe(noul)).append('\n');
        report.append("choice 解析     : ").append(describe(choice)).append('\n');
        report.append("score 解析      : ").append(describe(score)).append('\n');
        report.append("score legend    : ").append(score == null ? "-" : score.legend()).append('\n');
        report.append("legend 对齐     : ")
                .append(score != null && score.legendMatches(renderer.riskLevels())).append('\n');
        // Noul 是否携带 confidence / probabilities 直接决定「80 个号码概率」这一路
        // 有没有可用的置信度信息，只能靠真实响应确认，文档没有明确说明。
        report.append("noul 带 confidence : ").append(noul != null && noul.confidence() != null).append('\n');
        report.append("noul 带 probabilities: ").append(noul != null && !noul.probabilities().isEmpty()).append('\n');

        assertNotNull(noul, "noul 答案未按 id 回填，解析字段名可能不一致");
        assertTrue(noul.isNoul(), "probe_noul 未被识别为 noul 类型");
        assertTrue(noul.probabilityOr(-1) >= 0.0 && noul.probabilityOr(-1) <= 1.0,
                "noul 概率应落在 0-1，实际：" + noul.probability());

        assertNotNull(choice, "choice 答案未按 id 回填，解析字段名可能不一致");
        assertTrue(choice.isChoice(), "probe_choice 未被识别为 choice 类型");
        assertTrue(Set.of("balanced", "skewed").contains(choice.choice()),
                "choice 值应落在请求提交的选项内，实际：" + choice.choice());

        assertNotNull(score, "score 答案未按 id 回填，解析字段名可能不一致");
        assertTrue(score.isScore(), "probe_score 未被识别为 score 类型");
        assertTrue(score.legendMatches(renderer.riskLevels()),
                "legend 与请求档位不一致，档位语义可能错位，实际：" + score.legend());
    }

    @Test
    void estimatesAllEightyNumbersInBothLocales() {
        LotteryKl8FeatureReport featureReport = syntheticReport();

        LotteryKl8JevProbabilityResult zh = estimate(featureReport, JevPromptLocale.ZH);
        LotteryKl8JevProbabilityResult en = estimate(featureReport, JevPromptLocale.EN);

        report.append("\n--- [2] 81 问端到端（同一份特征，双语对照）---\n");
        appendResult("zh", zh);
        appendResult("en", en);

        report.append("\n--- [2] 双语差异 ---\n");
        report.append("平均绝对偏移差 (zh - en): ")
                .append(round(zh.meanAbsoluteDeviation() - en.meanAbsoluteDeviation())).append('\n');
        report.append("风险档位 zh/en         : ").append(zh.overallRiskScore())
                .append(" / ").append(en.overallRiskScore()).append('\n');
        report.append("最大偏移号码 zh/en      : ").append(zh.maxDeviationNumber())
                .append(" / ").append(en.maxDeviationNumber()).append('\n');
        appendBaselineAudit(zh, en);

        // 两个语言都必须走通完整链路：80 个号码有概率、档位表对齐、无号码退避
        for (LotteryKl8JevProbabilityResult result : List.of(zh, en)) {
            assertEquals(80, result.numbers().size(), "必须返回 80 个号码概率");
            assertEquals(4, result.topNumbers().size(), "必须给出 4 个候选号码");
            assertTrue(result.legendAligned(), "档位表未对齐，实际告警：" + result.warnings());
            assertFalse(result.model().isBlank(), "响应未回传模型版本");
            assertTrue(result.inputTokens() > 0, "响应未回传 input_tokens，用量统计失效");
            // 均值不假定等于 0.25——本次冒烟的目的恰恰是测量它偏离多少，把观测固化成断言没有意义。
            // 这里只守住解析崩坏的下限：均值若跑到这个量级之外，说明映射或回填已经出错。
            assertTrue(result.meanProbability() >= 0.10 && result.meanProbability() <= 0.50,
                    "概率均值超出合理量级，解析可能已崩坏，实际：" + result.meanProbability());
        }
    }

    /**
     * 重复性检验：同一份输入连跑多次，看候选号码是否稳定。
     *
     * 这是判断「排序有没有判别力」最直接的手段。如果模型真在区分号码，相同输入的输出
     * 应当高度重合；若每次几乎不重叠，说明排序由采样噪声主导，那无论概率数值看起来
     * 多合理，都不具备用于选号的判别力。本测试只记录、不判失败——不稳定正是要观测的结论。
     */
    @Test
    void repeatedRunsDoNotProduceStableRanking() {
        LotteryKl8FeatureReport featureReport = syntheticReport();
        List<List<Integer>> runs = new ArrayList<>(REPEAT_RUNS);
        for (int index = 0; index < REPEAT_RUNS; index += 1) {
            runs.add(estimate(featureReport, JevPromptLocale.ZH).topNumbers());
        }

        report.append("\n--- [3] 重复性检验（同一输入连跑 ")
                .append(REPEAT_RUNS).append(" 次）---\n");
        for (int index = 0; index < runs.size(); index += 1) {
            report.append("第 ").append(index + 1).append(" 次候选号码=").append(runs.get(index)).append('\n');
        }

        double overlapSum = 0;
        int pairCount = 0;
        for (int left = 0; left < runs.size(); left += 1) {
            for (int right = left + 1; right < runs.size(); right += 1) {
                int overlap = overlapCount(runs.get(left), runs.get(right));
                report.append("重叠：第 ").append(left + 1).append(" 次 vs 第 ").append(right + 1)
                        .append(" 次 = ").append(overlap).append(" / ").append(ESTIMATE_PICK_SIZE)
                        .append(" 个\n");
                overlapSum += overlap;
                pairCount += 1;
            }
        }
        double meanOverlap = pairCount == 0 ? 0.0 : overlapSum / pairCount;
        report.append("平均重叠=").append(round(meanOverlap))
                .append(" 个（完全稳定应为 ").append(ESTIMATE_PICK_SIZE).append(" 个）\n");
        report.append("判读：平均重叠远低于 ").append(ESTIMATE_PICK_SIZE)
                .append(" 时，排序由采样噪声主导，不具备选号判别力。\n");

        for (List<Integer> run : runs) {
            assertEquals(ESTIMATE_PICK_SIZE, run.size(), "每次调用都应给出完整候选集");
        }
    }

    /**
     * 计算两个候选集合的重叠个数。
     *
     * @param left  候选集合
     * @param right 候选集合
     * @return 交集大小
     */
    private int overlapCount(List<Integer> left, List<Integer> right) {
        return (int) left.stream().filter(right::contains).count();
    }

    /**
     * 基率守恒检验：这是本次冒烟最该看的一项。
     *
     * 物理事实是硬约束：80 个号码每期开出 20 个，所以 80 个号码的长期概率均值必然等于 0.25
     * （等价地，概率之和等于 20）。模型给出的均值只要不等于 0.25，
     * 就意味着它的「期望开出号码数」与规则冲突，这份概率分布不可能被校准过。
     * 因此只记录、不判失败：偏多少、往哪个方向偏，才是要观测的信号。
     *
     * @param zh 中文提示词结果
     * @param en 英文提示词结果
     */
    private void appendBaselineAudit(LotteryKl8JevProbabilityResult zh, LotteryKl8JevProbabilityResult en) {
        report.append("\n--- [2] 基率守恒检验（核心观测）---\n");
        report.append("物理约束：80 个号码每期开出 20 个 ⇒ 概率均值必须 = 0.25，概率之和必须 = 20\n");
        appendAuditLine("zh", zh);
        appendAuditLine("en", en);
    }

    /**
     * 输出单个语言的基率偏离。
     *
     * @param label  语言标签
     * @param result 概率推算结果
     */
    private void appendAuditLine(String label, LotteryKl8JevProbabilityResult result) {
        double impliedDrawn = result.meanProbability() * 80.0;
        double overstatementPercent = (impliedDrawn / 20.0 - 1.0) * 100.0;
        report.append('[').append(label).append("] 均值=").append(result.meanProbability())
                .append(" ⇒ 隐含期望开出数=").append(round(impliedDrawn)).append(" 个（应为 20）")
                .append(" 高估=").append(round(overstatementPercent)).append("%\n");
    }

    /**
     * 用指定语言跑一次完整概率推算。
     *
     * @param featureReport 特征报告
     * @param locale        提示词语言
     * @return 概率推算结果
     */
    private LotteryKl8JevProbabilityResult estimate(LotteryKl8FeatureReport featureReport, JevPromptLocale locale) {
        JevRuntimeConfigService config = config(locale);
        LotteryKl8JevProbabilityService service = new LotteryKl8JevProbabilityService(
                new LotteryKl8JevClient(new ObjectMapper(), config), config);
        return service.estimate(featureReport, ESTIMATE_PICK_SIZE);
    }

    /**
     * 把结果写入报告。
     *
     * @param label  语言标签
     * @param result 概率推算结果
     */
    private void appendResult(String label, LotteryKl8JevProbabilityResult result) {
        report.append('[').append(label).append("] model=").append(result.model())
                .append(" 耗时=").append(result.latencyMs()).append("ms")
                .append(" 输入token=").append(result.inputTokens()).append('\n');
        report.append("     概率均值=").append(result.meanProbability())
                .append(" 平均绝对偏移=").append(result.meanAbsoluteDeviation())
                .append(" 最大偏移号=").append(result.maxDeviationNumber())
                .append("(").append(result.maxDeviation()).append(")").append('\n');
        report.append("     风险分=").append(result.overallRiskScore())
                .append(" 档位=").append(result.overallRiskLabel()).append('\n');
        report.append("     候选号码=").append(result.topNumbers()).append('\n');
        report.append("     偏差最大的 5 个号码=").append(result.numbers().stream()
                .sorted((left, right) -> Double.compare(
                        Math.abs(right.deviationFromBaseline()), Math.abs(left.deviationFromBaseline())))
                .limit(5)
                .map(item -> item.number() + ":" + item.probability())
                .toList()).append('\n');
        report.append("     解读=").append(result.interpretation()).append('\n');
        report.append("     告警=").append(result.warnings()).append('\n');
    }

    /**
     * 直接发原始 HTTP 请求，用于取回未经解析的响应体。
     * 不用 {@link LotteryKl8JevClient#evaluate} 是因为它只返回解析结果，
     * 而本次冒烟的目的恰恰是先看到原始 JSON。
     *
     * @param requestBody 请求体
     * @return HTTP 响应
     * @throws Exception 网络异常
     */
    private HttpResponse<String> sendRaw(String requestBody) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofMillis(LIVE_TIMEOUT_MS))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build()
                .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    /**
     * 构造 Jev 配置服务。
     *
     * @param locale 提示词语言
     * @return 配置服务
     */
    private JevRuntimeConfigService config(JevPromptLocale locale) {
        return new JevRuntimeConfigService(true, false, apiKey,
                JevRuntimeConfig.DEFAULT_MODEL, endpoint, LIVE_TIMEOUT_MS, locale.code());
    }

    /**
     * 用确定性随机数合成一份结构完整的特征报告。
     * 数据是假的，但字段齐全且自洽，足以走通 state 渲染与 81 问链路。
     *
     * @return 特征报告
     */
    private LotteryKl8FeatureReport syntheticReport() {
        List<LotteryKl8Draw> draws = syntheticDraws();
        int[] frequency = new int[81];
        int[] lastSeen = new int[81];
        java.util.Arrays.fill(lastSeen, -1);
        for (int index = 0; index < draws.size(); index += 1) {
            for (String part : draws.get(index).getNumbers().split(",")) {
                int number = Integer.parseInt(part.trim());
                frequency[number] += 1;
                lastSeen[number] = index;
            }
        }

        List<LotteryKl8NumberProfile> profiles = new ArrayList<>(80);
        for (int number = 1; number <= 80; number += 1) {
            int recent30 = 0;
            for (int index = 0; index < Math.min(30, draws.size()); index += 1) {
                if (draws.get(index).getNumbers().contains("," + number + ",")
                        || draws.get(index).getNumbers().startsWith(number + ",")
                        || draws.get(index).getNumbers().endsWith("," + number)) {
                    recent30 += 1;
                }
            }
            double composite = frequency[number] * 0.5 + (lastSeen[number] < 0 ? 0 : lastSeen[number]) * 0.1;
            profiles.add(new LotteryKl8NumberProfile(
                    number,
                    frequency[number],
                    frequency[number] / (double) draws.size(),
                    recent30,
                    recent30,
                    recent30,
                    frequency[number],
                    lastSeen[number] < 0 ? 0 : lastSeen[number],
                    lastSeen[number] < 0 ? 0 : lastSeen[number],
                    lastSeen[number] < 0 ? 0 : lastSeen[number] + 1,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    "%d-%d".formatted(((number - 1) / 20) * 20 + 1, ((number - 1) / 20) * 20 + 20),
                    number % 2 == 0 ? "偶" : "奇",
                    number % 10,
                    number % 10,
                    composite,
                    frequency[number] > draws.size() * 0.25 ? List.of("热号") : List.of("冷号")));
        }

        List<Integer> hot = IntStream.range(1, 81).boxed()
                .sorted((left, right) -> Integer.compare(frequency[right], frequency[left]))
                .limit(10).toList();
        List<Integer> cold = IntStream.range(1, 81).boxed()
                .sorted((left, right) -> Integer.compare(frequency[left], frequency[right]))
                .limit(10).toList();

        Map<Integer, Integer> missing = new LinkedHashMap<>();
        for (int number = 1; number <= 80; number += 1) {
            missing.put(number, lastSeen[number] < 0 ? draws.size() : lastSeen[number]);
        }

        return new LotteryKl8FeatureReport(
                draws.size(),
                draws.get(0).getIssueNo(),
                hot,
                cold,
                missing,
                Map.of("1-20", 25, "21-40", 25, "41-60", 25, "61-80", 25),
                Map.of("0", 8, "1", 8, "2", 8, "3", 8, "4", 8, "5", 8, "6", 8, "7", 8, "8", 8, "9", 8),
                Map.of("0", 8, "1", 8, "2", 8, "3", 8, "4", 8, "5", 8, "6", 8, "7", 8, "8", 8, "9", 8),
                40,
                40,
                draws,
                profiles,
                List.of(),
                List.of(),
                LotteryKl8BacktestSummary.empty(4),
                LotteryKl8OptimizedPortfolio.empty(),
                List.of(),
                "合成特征，仅用于冒烟",
                "合成特征，仅用于冒烟");
    }

    /**
     * 合成开奖记录，号码固定为每期 20 个，最新在前。
     *
     * @return 开奖记录
     */
    private List<LotteryKl8Draw> syntheticDraws() {
        Random random = new Random(20260920L);
        List<LotteryKl8Draw> draws = new ArrayList<>(SYNTHETIC_DRAWS);
        for (int index = 0; index < SYNTHETIC_DRAWS; index += 1) {
            Set<Integer> numbers = new TreeSet<>();
            while (numbers.size() < 20) {
                numbers.add(random.nextInt(80) + 1);
            }
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo("2026%03d".formatted(SYNTHETIC_DRAWS - index));
            draw.setDrawDate(LocalDate.of(2026, 1, 1).plusDays(SYNTHETIC_DRAWS - index));
            draw.setNumbers(numbers.stream().map(String::valueOf).collect(Collectors.joining(",")));
            draws.add(draw);
        }
        return draws;
    }

    /**
     * 描述一个答案的关键字段，用于人工核对字段名。
     *
     * @param answer 答案
     * @return 描述文本
     */
    private String describe(JevAnswer answer) {
        if (answer == null) {
            return "null（未回填）";
        }
        return "type=%s prob=%s choice=%s score=%s confidence=%s probabilities=%s".formatted(
                answer.type(), answer.probability(), answer.choice(), answer.score(),
                answer.confidence(), answer.probabilities());
    }

    /**
     * 读取密钥：优先环境变量，其次密钥文件。
     *
     * @return 密钥原文，未配置时返回空串
     */
    private String resolveApiKey() {
        String fromEnv = env("TYPESAFE_API_KEY");
        if (hasText(fromEnv)) {
            return fromEnv.trim();
        }
        Path keyFile = Path.of(hasText(env("JEV_KEY_FILE")) ? env("JEV_KEY_FILE") : DEFAULT_KEY_FILE);
        if (!Files.exists(keyFile)) {
            return "";
        }
        try {
            return Files.readString(keyFile, StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            return "";
        }
    }

    private String env(String name) {
        return System.getenv(name);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String mask(String value) {
        if (value.length() <= 8) {
            return "****";
        }
        return value.substring(0, 4) + "****" + value.substring(value.length() - 4);
    }

    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
