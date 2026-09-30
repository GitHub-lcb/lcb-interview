package com.lcbinterview.service;

import com.lcbinterview.model.LotteryKl8Draw;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 快乐8号码概率推算服务，基于 Jev（TypeSafe System One）决策模型。
 *
 * 工作方式：把历史特征压成一份状态，一次请求里声明 80 个 Noul 问题
 * （「号码 N 会在下一期开出吗」）加 1 个 Score 问题（组合结构风险），
 * 由 Jev 并行求解后回收 80 个概率与一个风险档位。
 *
 * 必须明确的边界：Jev 给出的是**校准过的模型信念**，不是对随机开奖的预测能力。
 * 快乐8 每期从 80 个号码开出 20 个，单号真实概率恒为 0.25，模型无法改变它。
 * 因此本服务的返回值刻意附带偏差统计与中文解读，
 * 且是否允许影响推荐排序由 {@link LotteryKl8JevCalibrationService} 的校准闸门决定。
 */
@Service
public class LotteryKl8JevProbabilityService {

    private static final Logger log = LoggerFactory.getLogger(LotteryKl8JevProbabilityService.class);

    /** 快乐8 单号理论开出概率：每期 80 选 20。 */
    public static final double BASELINE_PROBABILITY = 20.0 / 80.0;

    /** 号码概率问题 id 前缀，完整 id 形如 n37。 */
    private static final String NUMBER_QUESTION_PREFIX = "n";

    /** 结构风险 Score 问题 id。 */
    private static final String RISK_QUESTION_ID = "structure_risk";

    /** 默认选号数量，与 {@link LotteryKl8RecommendationPolicy#DEFAULT_PICK_SIZE} 保持一致。 */
    public static final int DEFAULT_PICK_SIZE = 4;

    /** 单次请求最多问题数。超过则分批，避免触发服务端请求体或问题数上限。 */
    private static final int MAX_QUESTIONS_PER_REQUEST = 120;

    /** 状态里携带的最近开奖期数上限，控制 state 体积。 */
    private static final int MAX_STATE_RECENT_DRAWS = 30;

    /** 状态里携带的遗漏榜长度。 */
    private static final int MAX_STATE_MISSING_ENTRIES = 20;

    /** 状态里携带的共现对数量。 */
    private static final int MAX_STATE_PAIR_ENTRIES = 20;

    /** 每期开奖号码数量，来自快乐8规则，是基率守恒判据的基准。 */
    private static final int DRAWN_PER_ISSUE = 20;

    /**
     * 基率守恒的容许偏差，单位为「号码个数」。
     * 80 个概率之和在理想情况下必须等于 20；偏差超过 1 个号码（5%）即说明
     * 模型给出的不是一份满足规则的分布，此时概率不具备绝对含义。
     */
    private static final double CONSERVATION_TOLERANCE = 1.0;

    /**
     * 判定「整体同向偏移」的号码数量阈值（80 的 90%）。
     * 超过该数量同向偏离基线，说明模型在做整体平移而非号码间区分，
     * 此时排序结果的名义区分度是假的。
     */
    private static final int DIRECTIONAL_DOMINANCE_THRESHOLD = 72;

    private final LotteryKl8JevClient jevClient;
    private final JevRuntimeConfigService configService;

    /**
     * 创建号码概率推算服务。
     *
     * @param jevClient     Jev 客户端
     * @param configService Jev 配置服务
     */
    public LotteryKl8JevProbabilityService(LotteryKl8JevClient jevClient, JevRuntimeConfigService configService) {
        this.jevClient = jevClient;
        this.configService = configService;
    }

    /**
     * 判断当前是否具备调用 Jev 的条件。
     *
     * @return true 表示开关打开且密钥、模型、地址齐全
     */
    public boolean available() {
        return configService.current().callable();
    }

    /**
     * 判断 Jev 概率是否获准影响推荐排序。
     *
     * @return true 表示已配置且人工闸门已打开
     */
    public boolean scoringAllowed() {
        return configService.current().scoringAllowed();
    }

    /**
     * 根据历史特征报告推算下一期 80 个号码的开出概率。
     *
     * @param report 历史特征报告
     * @return 概率推算结果，含偏差统计与中文解读
     * @throws IllegalStateException Jev 不可用或调用失败
     */
    public LotteryKl8JevProbabilityResult estimate(LotteryKl8FeatureReport report) {
        return estimate(report, DEFAULT_PICK_SIZE);
    }

    /**
     * 根据历史特征报告推算下一期 80 个号码的开出概率。
     *
     * @param report   历史特征报告
     * @param pickSize 每组号码数量，仅用于问题措辞与顶层号码数量
     * @return 概率推算结果
     * @throws IllegalStateException Jev 不可用或调用失败
     */
    public LotteryKl8JevProbabilityResult estimate(LotteryKl8FeatureReport report, int pickSize) {
        if (report == null) {
            throw new IllegalArgumentException("历史特征报告不能为空");
        }
        if (!available()) {
            throw new IllegalStateException("Jev 不可用：" + configService.publicStatus().message());
        }
        // 渲染器按配置决定送模型的文案语言；人看的解读与标签不受其影响
        JevPromptRenderer renderer = new JevPromptRenderer(configService.current().promptLocale());

        Map<String, Object> state = buildState(report, pickSize, renderer);
        List<JevQuestion> questions = buildQuestions(pickSize, renderer);

        Map<String, JevAnswer> answers = new LinkedHashMap<>();
        String modelVersion = "";
        long totalInputTokens = 0;
        long totalOutputTokens = 0;
        long totalLatencyMs = 0;
        // 分批串行执行：问题数固定在 81 左右，正常情况下只有一批；分批只是为了防止上游对单请求问题数设限
        for (int start = 0; start < questions.size(); start += MAX_QUESTIONS_PER_REQUEST) {
            int end = Math.min(start + MAX_QUESTIONS_PER_REQUEST, questions.size());
            JevEvaluation evaluation = jevClient.evaluate(state, questions.subList(start, end));
            answers.putAll(evaluation.answers());
            modelVersion = evaluation.model();
            totalInputTokens += evaluation.inputTokens();
            totalOutputTokens += evaluation.outputTokens();
            totalLatencyMs += evaluation.latencyMs();
        }
        if (answers.isEmpty()) {
            throw new IllegalStateException("Jev 未返回任何答案，无法推算号码概率");
        }
        return assembleReport(report, answers, modelVersion, pickSize,
                totalLatencyMs, totalInputTokens, totalOutputTokens, renderer);
    }

    /**
     * 把特征报告压成 Jev 的状态输入。
     * 字段全部是历史统计量，不含任何未来信息；用英文键是为了让 JSON 结构稳定，
     * 语义说明通过 {@code schema_note} 一次性交代，减少 state 体积。
     *
     * 游戏规则由 {@link JevPromptRenderer#gameName()} 显式写出，而不是只给「快乐8」这个名称：
     * 通用模型语料中并无中文彩票术语，只给名称会让它无从判断号码范围与每期开出数量。
     *
     * 深度摘要 {@code deep_summary} 不再送入：它把 {@code number_profiles} 的数字用中文散文复述了一遍，
     * 信息高度冗余，却是整个 state 里最大的一块自由文本，既推高 token 成本，
     * 又在非中文最优的模型上引入最大的理解风险。
     *
     * @param report   历史特征报告
     * @param pickSize 每组号码数量
     * @param renderer 提示词渲染器
     * @return 状态映射
     */
    private Map<String, Object> buildState(LotteryKl8FeatureReport report, int pickSize, JevPromptRenderer renderer) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("schema_note", renderer.schemaNote());
        state.put("game", renderer.gameName());
        state.put("play_mode", renderer.playMode(pickSize));
        state.put("draws_used", report.baseIssueCount());
        state.put("latest_issue_no", report.latestIssueNo());
        state.put("theoretical_single_number_probability", BASELINE_PROBABILITY);
        state.put("hot_numbers", report.hotNumbers());
        state.put("cold_numbers", report.coldNumbers());
        state.put("top_missing", topMissing(report));
        state.put("range_distribution", report.rangeCounts());
        state.put("tail_distribution", report.tailCounts());
        state.put("modulo10_distribution", report.moduloCounts());
        state.put("parity", Map.of("odd", report.oddCount(), "even", report.evenCount()));
        state.put("recent_draws", recentDraws(report));
        state.put("number_profiles", numberProfiles(report, renderer));
        state.put("top_cooccurrence_pairs", pairHighlights(report));
        state.put("candidate_pool", candidatePool(report, renderer));
        state.put("backtest", backtestSummary(report, renderer));
        return state;
    }

    /**
     * 构造 80 个号码概率问题与 1 个结构风险问题。
     *
     * 号码问题带 criteria：官方文档建议边界含糊时用 true/false 说明两边含义，
     * 这里并把理论基率 0.25 写进 criteria，给模型一个明确锚点，
     * 避免它在冷热判断下把先验整体抬离基线。
     *
     * @param pickSize 每组号码数量
     * @param renderer 提示词渲染器
     * @return 问题列表
     */
    private List<JevQuestion> buildQuestions(int pickSize, JevPromptRenderer renderer) {
        List<JevQuestion> questions = new ArrayList<>(81);
        Map<String, String> numberCriteria = renderer.numberCriteria();
        for (int number = 1; number <= 80; number += 1) {
            questions.add(JevQuestion.noul(
                    NUMBER_QUESTION_PREFIX + number,
                    renderer.numberInstruction(number),
                    numberCriteria));
        }
        questions.add(JevQuestion.score(
                RISK_QUESTION_ID,
                renderer.riskInstruction(pickSize),
                renderer.riskLevels()));
        return questions;
    }

    /**
     * 汇总答案为概率推算结果。
     *
     * @param report            历史特征报告
     * @param answers           问题 id -&gt; 答案
     * @param modelVersion      实际回答的模型版本
     * @param pickSize          每组号码数量
     * @param latencyMs         端到端耗时
     * @param inputTokens       输入 token 数
     * @param outputTokens      输出 token 数
     * @param renderer          提示词渲染器，用于取固定的中文档位文案
     * @return 概率推算结果
     */
    private LotteryKl8JevProbabilityResult assembleReport(
            LotteryKl8FeatureReport report,
            Map<String, JevAnswer> answers,
            String modelVersion,
            int pickSize,
            long latencyMs,
            long inputTokens,
            long outputTokens,
            JevPromptRenderer renderer) {
        List<Integer> missingNumbers = new ArrayList<>();
        List<Double> probabilities = new ArrayList<>(80);
        for (int number = 1; number <= 80; number += 1) {
            JevAnswer answer = answers.get(NUMBER_QUESTION_PREFIX + number);
            if (answer == null || !answer.isNoul()) {
                missingNumbers.add(number);
                probabilities.add(BASELINE_PROBABILITY);
                continue;
            }
            probabilities.add(answer.probabilityOr(BASELINE_PROBABILITY));
        }

        List<Integer> rankedNumbers = new ArrayList<>(80);
        for (int number = 1; number <= 80; number += 1) {
            rankedNumbers.add(number);
        }
        rankedNumbers.sort(Comparator
                .comparingDouble((Integer number) -> probabilities.get(number - 1)).reversed()
                .thenComparingInt(number -> number));

        Map<Integer, Integer> rankByNumber = new LinkedHashMap<>();
        for (int index = 0; index < rankedNumbers.size(); index += 1) {
            rankByNumber.put(rankedNumbers.get(index), index + 1);
        }

        List<LotteryKl8JevNumberProbability> numberProbabilities = new ArrayList<>(80);
        double sum = 0;
        double absoluteDeviationSum = 0;
        double maxDeviation = 0;
        int maxDeviationNumber = 0;
        int aboveBaselineCount = 0;
        for (int number = 1; number <= 80; number += 1) {
            double probability = probabilities.get(number - 1);
            double deviation = probability - BASELINE_PROBABILITY;
            sum += probability;
            absoluteDeviationSum += Math.abs(deviation);
            if (deviation > 0) {
                aboveBaselineCount += 1;
            }
            if (Math.abs(deviation) > maxDeviation) {
                maxDeviation = Math.abs(deviation);
                maxDeviationNumber = number;
            }
            numberProbabilities.add(new LotteryKl8JevNumberProbability(
                    number, round(probability), round(deviation), rankByNumber.get(number)));
        }

        double meanProbability = sum / 80.0;
        double meanAbsoluteDeviation = absoluteDeviationSum / 80.0;

        JevAnswer riskAnswer = answers.get(RISK_QUESTION_ID);
        double riskScore = riskAnswer == null || riskAnswer.score() == null ? 0.0 : riskAnswer.score();
        double riskConfidence = riskAnswer == null ? 0.0 : riskAnswer.confidenceOrZero();
        // legend 是校验档位语义是否错位的唯一手段。模型没有回传完整档位表时，
        // 按索引取到的文字未必对应当前档位，因此必须显式告警而不是静默使用。
        boolean legendAligned = riskAnswer != null && riskAnswer.legendMatches(renderer.riskLevels());

        List<Integer> topNumbers = rankedNumbers.stream().limit(pickSize).sorted().toList();

        return new LotteryKl8JevProbabilityResult(
                modelVersion,
                BASELINE_PROBABILITY,
                List.copyOf(numberProbabilities),
                topNumbers,
                pickSize,
                round(meanProbability),
                round(sum),
                round(meanAbsoluteDeviation),
                round(maxDeviation),
                maxDeviationNumber,
                aboveBaselineCount,
                round(riskScore),
                renderer.userFacingRiskLabel(riskScore),
                round(riskConfidence),
                legendAligned,
                latencyMs,
                inputTokens,
                outputTokens,
                interpretation(report, meanAbsoluteDeviation, sum, aboveBaselineCount,
                        maxDeviation, maxDeviationNumber, missingNumbers.size()),
                warnings(missingNumbers, legendAligned));
    }

    /**
     * 生成中文解读。
     * 这里刻意不把概率说成「预测」：单号真实概率恒为 0.25，平均绝对偏移落在小样本波动范围内时
     * 必须直说「没有可利用信号」。
     *
     * 判据的优先级是刻意安排的：先查「基率守恒」这个硬约束，再看偏移方向是否一致，
     * 最后才看平均绝对偏移。原因是真实调用验证后发现，模型会把 80 个号码的概率整体抬高——
     * 此时平均绝对偏移看似温和（7 个百分点），概率之和却已经与「每期只开 20 个」的规则冲突。
     * 只看平均绝对偏移会把系统性偏差误读成小样本波动，等于放过了最该报告的缺陷。
     *
     * @param report                历史特征报告
     * @param meanAbsoluteDeviation 平均绝对偏移
     * @param impliedDrawnCount     80 个概率之和，即隐含的期望开出号码数
     * @param aboveBaselineCount    概率高于基线的号码数量
     * @param maxDeviation          最大绝对偏移
     * @param maxDeviationNumber    偏移最大的号码
     * @param missingCount          未返回概率的号码数量
     * @return 中文解读
     */
    private String interpretation(
            LotteryKl8FeatureReport report,
            double meanAbsoluteDeviation,
            double impliedDrawnCount,
            int aboveBaselineCount,
            double maxDeviation,
            int maxDeviationNumber,
            int missingCount) {
        double excess = impliedDrawnCount - DRAWN_PER_ISSUE;
        int belowBaselineCount = 80 - aboveBaselineCount;

        StringBuilder text = new StringBuilder();
        text.append("理论基线为 25.00%%：80 个号码每期开出 %d 个，因此 80 个概率之和必须等于 %d。"
                .formatted(DRAWN_PER_ISSUE, DRAWN_PER_ISSUE));
        text.append("本次概率之和为 %.2f，隐含期望开出 %.2f 个号码。".formatted(impliedDrawnCount, impliedDrawnCount));
        if (Math.abs(excess) <= CONSERVATION_TOLERANCE) {
            text.append("该组概率满足基率守恒。");
        } else {
            text.append("比规则%s %.2f 个（%s %.1f%%），不满足基率守恒，"
                    .formatted(excess > 0 ? "多出" : "少出", Math.abs(excess),
                            excess > 0 ? "高估" : "低估", Math.abs(excess) / DRAWN_PER_ISSUE * 100.0));
            text.append("因此这些数值只能在同一期内部作相对排序参考，不能当作绝对概率使用。");
        }

        text.append("80 个号码中 %d 个高于基线、%d 个低于基线。".formatted(aboveBaselineCount, belowBaselineCount));
        if (aboveBaselineCount >= DIRECTIONAL_DOMINANCE_THRESHOLD
                || belowBaselineCount >= DIRECTIONAL_DOMINANCE_THRESHOLD) {
            text.append("偏移方向高度一致，属于整体%s而非号码间区分，排序的名义区分度不可当真。"
                    .formatted(aboveBaselineCount >= DIRECTIONAL_DOMINANCE_THRESHOLD ? "抬高" : "压低"));
        } else if (aboveBaselineCount > 0 && belowBaselineCount > 0) {
            text.append("偏移方向有来有回，具备一定的号码间区分度。");
        }

        text.append("基于 %d 期历史特征，平均绝对偏移 %.2f 个百分点，最大偏移 %d 号 %.2f 个百分点。"
                .formatted(report.baseIssueCount(), meanAbsoluteDeviation * 100.0,
                        maxDeviationNumber, maxDeviation * 100.0));
        if (Math.abs(excess) <= CONSERVATION_TOLERANCE && meanAbsoluteDeviation <= 0.03) {
            text.append("整体贴近随机基线，未体现可利用信号，这与独立同分布开奖的预期一致。");
        } else {
            text.append("该偏差是否具备信号意义，必须由校准闸门以样本外回测判定，不能由单次结果认定。");
        }
        text.append("该结果只反映模型信念，不改变任何号码的实际开出概率。");
        if (missingCount > 0) {
            text.append("其中 %d 个号码未返回概率，已按 25.00%% 基线退避。".formatted(missingCount));
        }
        return text.toString();
    }

    /**
     * 构造风险提示。
     *
     * @param missingNumbers 未返回概率的号码
     * @param legendAligned  Score 档位表是否与请求一致
     * @return 风险提示列表
     */
    private List<String> warnings(List<Integer> missingNumbers, boolean legendAligned) {
        List<String> warnings = new ArrayList<>();
        warnings.add("彩票开奖结果具有独立随机性，Jev 给出的概率不会改变号码的实际开出概率。");
        warnings.add("Jev 返回的置信度反映概率分布形状，不等于答案正确的概率。");
        warnings.add("本结果仅用于统计研究与娱乐参考，不构成投注建议。");
        if (!legendAligned) {
            warnings.add("Jev 回传的 Score 档位表（legend）缺失或与请求的档位定义不一致，"
                    + "档位文字可能错位，风险档位仅作参考。");
        }
        if (!missingNumbers.isEmpty()) {
            warnings.add("以下号码未获得 Jev 概率，已按 25% 基线退避：" + missingNumbers);
        }
        return List.copyOf(warnings);
    }

    /**
     * 取遗漏期数最多的若干号码。
     *
     * @param report 历史特征报告
     * @return 号码与遗漏期数的有序映射
     */
    private Map<Integer, Integer> topMissing(LotteryKl8FeatureReport report) {
        Map<Integer, Integer> result = new LinkedHashMap<>();
        report.missingNumbers().entrySet().stream()
                .sorted((left, right) -> right.getValue().compareTo(left.getValue()))
                .limit(MAX_STATE_MISSING_ENTRIES)
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result;
    }

    /**
     * 取最近若干期开奖号码。
     *
     * @param report 历史特征报告
     * @return 期号与号码的列表
     */
    private List<Map<String, Object>> recentDraws(LotteryKl8FeatureReport report) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (LotteryKl8Draw draw : report.draws()) {
            if (result.size() >= MAX_STATE_RECENT_DRAWS) {
                break;
            }
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("issue_no", draw.getIssueNo());
            node.put("draw_date", draw.getDrawDate() == null ? "" : draw.getDrawDate().toString());
            node.put("numbers", parseNumbers(draw.getNumbers()));
            result.add(node);
        }
        return result;
    }

    /**
     * 取号码画像的精简投影。
     * 完整的 20 个字段没必要全给模型，只保留与冷热、遗漏、趋势、结构相关的量。
     * 标签词经渲染器转换：特征层产出的是中文标签，英文模式下需映射为等价英文词，
     * 未收录的标签原样保留，避免特征层新增标签时丢内容。
     *
     * @param report   历史特征报告
     * @param renderer 提示词渲染器
     * @return 号码画像列表
     */
    private List<Map<String, Object>> numberProfiles(LotteryKl8FeatureReport report, JevPromptRenderer renderer) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (LotteryKl8NumberProfile profile : report.numberProfiles()) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("number", profile.number());
            node.put("frequency", profile.frequency());
            node.put("recent30", profile.recent30Frequency());
            node.put("recent60", profile.recent60Frequency());
            node.put("current_missing", profile.currentMissing());
            node.put("average_missing", round(profile.averageMissing()));
            node.put("max_missing", profile.maxMissing());
            node.put("trend", round(profile.trendScore()));
            node.put("volatility", round(profile.volatility()));
            node.put("composite_score", round(profile.compositeScore()));
            node.put("tags", translateTags(profile.tags(), renderer));
            result.add(node);
        }
        return result;
    }

    /**
     * 转换标签列表。
     *
     * @param tags     原始标签
     * @param renderer 提示词渲染器
     * @return 转换后的标签列表
     */
    private List<String> translateTags(List<String> tags, JevPromptRenderer renderer) {
        List<String> translated = new ArrayList<>(tags.size());
        for (String tag : tags) {
            translated.add(renderer.tag(tag));
        }
        return translated;
    }

    /**
     * 取高共现号码对。
     *
     * @param report 历史特征报告
     * @return 共现对列表
     */
    private List<Map<String, Object>> pairHighlights(LotteryKl8FeatureReport report) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (LotteryKl8PairProfile pair : report.pairHighlights()) {
            if (result.size() >= MAX_STATE_PAIR_ENTRIES) {
                break;
            }
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("pair", List.of(pair.leftNumber(), pair.rightNumber()));
            node.put("count", pair.count());
            node.put("lift", round(pair.lift()));
            result.add(node);
        }
        return result;
    }

    /**
     * 取候选池快照。
     * roles 实际取的是号码标签，与 {@code number_profiles.tags} 同源，因此同样需要转换。
     *
     * @param report   历史特征报告
     * @param renderer 提示词渲染器
     * @return 候选号码列表
     */
    private List<Map<String, Object>> candidatePool(LotteryKl8FeatureReport report, JevPromptRenderer renderer) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (LotteryKl8CandidateNumber candidate : report.candidatePool()) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("number", candidate.number());
            node.put("score", round(candidate.score()));
            node.put("roles", translateTags(candidate.roles(), renderer));
            result.add(node);
        }
        return result;
    }

    /**
     * 取历史回测摘要的精简投影。
     * 中文自然语言 summary 在英文模式下不送：它的信息已由数值字段承载，
     * 留下来只会让提示词语言混杂，同时推高 token 成本。
     *
     * @param report   历史特征报告
     * @param renderer 提示词渲染器
     * @return 回测摘要映射
     */
    private Map<String, Object> backtestSummary(LotteryKl8FeatureReport report, JevPromptRenderer renderer) {
        Map<String, Object> node = new LinkedHashMap<>();
        LotteryKl8BacktestSummary summary = report.backtestSummary();
        node.put("evaluated_issue_count", summary.evaluatedIssueCount());
        node.put("average_hit_count", round(summary.averageHitCount()));
        node.put("max_hit_count", summary.maxHitCount());
        node.put("hit_at_least_three_rate", round(summary.hitAtLeastThreeRate()));
        node.put("weight_profile", renderer.weightProfileName(summary.weightProfileName()));
        List<String> factors = new ArrayList<>(summary.topFactorNames().size());
        for (String factor : summary.topFactorNames()) {
            factors.add(renderer.factorName(factor));
        }
        node.put("top_factor_names", factors);
        if (!renderer.dropChineseProse()) {
            node.put("summary", summary.summary());
        }
        return node;
    }

    /**
     * 解析逗号分隔的号码串。
     * 这里刻意不依赖 {@link LotteryKl8FeatureService#parseNumbers(String)}：
     * 一旦后续把 Jev 打分接入特征服务，复用会形成服务间循环依赖。
     *
     * @param numbers 逗号分隔号码串
     * @return 号码列表，非法内容被忽略
     */
    private List<Integer> parseNumbers(String numbers) {
        List<Integer> result = new ArrayList<>();
        if (!StringUtils.hasText(numbers)) {
            return result;
        }
        for (String part : numbers.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                result.add(Integer.parseInt(trimmed));
            } catch (NumberFormatException e) {
                log.warn("开奖号码解析失败，已忽略：{}", trimmed);
            }
        }
        return result;
    }

    /**
     * 保留四位小数，避免把浮点噪声写进接口响应。
     *
     * @param value 原始值
     * @return 四舍五入后的值
     */
    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
