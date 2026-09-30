package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Jev 号码概率校准闸门。
 *
 * 这是整条 Jev 链路的裁判：任何「模型能提高命中率」的说法都必须在这里过关。
 * 做法是走查前推——第 i 期只用第 i 期之前的历史构建特征报告，让 Jev 推算 80 个号码概率，
 * 再与当期真实开奖比对，逐期算出 Brier 分数，与常数 0.25 基线做配对比较。
 *
 * 为什么用 Brier 而不是命中率：Brier 是严格适当评分规则，
 * 对「把开出号码的概率抬高、把未开出号码压低」这种判别力敏感，
 * 而单纯整体抬高概率（虚高）不会改善 Brier，因此无法用虚高蒙混过关。
 *
 * 参考量级：真正具备判别力（把 20 个开出号码抬到 30%、60 个未开出压到 23.33%，均值仍为 25%）时，
 * Brier 差值约为 -0.024；若 Jev 输出的概率与开奖无判别关系，差值应约等于 0。
 * 因此 {@code brierDelta} 长期贴近 0 是预期结果，不是实现缺陷。
 */
@Service
public class LotteryKl8JevCalibrationService {

    private static final Logger log = LoggerFactory.getLogger(LotteryKl8JevCalibrationService.class);

    /** 默认评估期数。每期一次 Jev 调用，期数越大耗时与成本越高。 */
    public static final int DEFAULT_ISSUES = 5;

    /** 单次校准最多评估期数，防止误操作触发长时间外呼。 */
    public static final int MAX_ISSUES = 20;

    /** 默认构建特征报告所用的历史期数。 */
    public static final int DEFAULT_BASE_ISSUE_COUNT = 200;

    /** 构建特征报告所需的最小历史期数，与特征服务保持一致。 */
    private static final int MIN_BASE_ISSUE_COUNT = 20;

    /** 对数损失的截断上下界，避免 ln(0) 导致无穷大。 */
    private static final double LOG_LOSS_CLIP_LOW = 0.001;

    /** 对数损失的截断上界。 */
    private static final double LOG_LOSS_CLIP_HIGH = 0.999;

    /** 具备真实判别力时的 Brier 差值参考量级，用于解读文案。 */
    private static final double MEANINGFUL_BRIER_DELTA = -0.024;

    private final LotteryKl8DrawMapper drawMapper;
    private final LotteryKl8FeatureService featureService;
    private final LotteryKl8JevProbabilityService probabilityService;
    private final JevRuntimeConfigService configService;

    /**
     * 创建校准服务。
     *
     * @param drawMapper        开奖记录 Mapper
     * @param featureService    特征服务，复用其走查前推构建能力
     * @param probabilityService Jev 概率推算服务
     * @param configService     Jev 配置服务
     */
    public LotteryKl8JevCalibrationService(
            LotteryKl8DrawMapper drawMapper,
            LotteryKl8FeatureService featureService,
            LotteryKl8JevProbabilityService probabilityService,
            JevRuntimeConfigService configService) {
        this.drawMapper = drawMapper;
        this.featureService = featureService;
        this.probabilityService = probabilityService;
        this.configService = configService;
    }

    /**
     * 使用默认参数运行校准。
     *
     * @param pickSize 每组号码数量
     * @return 校准报告
     */
    public LotteryKl8JevCalibrationReport calibrate(int pickSize) {
        return calibrate(DEFAULT_ISSUES, DEFAULT_BASE_ISSUE_COUNT, pickSize);
    }

    /**
     * 运行 Jev 号码概率校准。
     *
     * 注意：本方法是外呼密集型操作，耗时约为「期数 × 单次 Jev 调用耗时」，
     * 因此对期数做了硬上限，并且只允许显式触发。
     *
     * @param issues         评估期数，超出范围会被夹到 [1, MAX_ISSUES]
     * @param baseIssueCount 构建特征报告所用的历史期数
     * @param pickSize       每组号码数量
     * @return 校准报告
     * @throws BusinessException 历史开奖数据不足
     */
    @Transactional(readOnly = true)
    public LotteryKl8JevCalibrationReport calibrate(int issues, int baseIssueCount, int pickSize) {
        if (!probabilityService.available()) {
            throw new BusinessException(400, "Jev 不可用：" + configService.publicStatus().message());
        }
        int issuesToUse = Math.max(1, Math.min(MAX_ISSUES, issues <= 0 ? DEFAULT_ISSUES : issues));
        int baseToUse = Math.max(MIN_BASE_ISSUE_COUNT,
                baseIssueCount <= 0 ? DEFAULT_BASE_ISSUE_COUNT : baseIssueCount);
        int requiredDraws = issuesToUse + baseToUse;
        List<LotteryKl8Draw> draws = loadRecentDraws(requiredDraws);
        if (draws.size() < requiredDraws) {
            throw new BusinessException(400,
                    "校准需要至少 %d 期开奖数据，当前仅 %d 期，请先同步".formatted(requiredDraws, draws.size()));
        }

        List<Double> issueDiffs = new ArrayList<>();
        double totalSquaredJev = 0;
        double totalSquaredBaseline = 0;
        double totalLogLoss = 0;
        double probabilitySum = 0;
        int totalPairs = 0;
        int totalHits = 0;
        long totalLatencyMs = 0;
        long totalInputTokens = 0;
        Set<String> modelVersions = new LinkedHashSet<>();

        for (int index = 0; index < issuesToUse; index += 1) {
            // 只用目标期之前的历史构建报告，保证不读入任何未来开奖，避免结果虚高
            List<LotteryKl8Draw> history = draws.subList(index + 1, index + 1 + baseToUse);
            LotteryKl8Draw target = draws.get(index);
            Set<Integer> actualNumbers = new HashSet<>(featureService.parseNumbers(target.getNumbers()));
            LotteryKl8FeatureReport report = featureService.buildReportFromDraws(
                    history, LotteryKl8StrategyCalibration.neutral(), pickSize, Map.of());
            LotteryKl8JevProbabilityResult result = probabilityService.estimate(report, pickSize);
            if (result.model() != null && !result.model().isBlank()) {
                modelVersions.add(result.model());
            }
            totalLatencyMs += result.latencyMs();
            totalInputTokens += result.inputTokens();

            double squaredJev = 0;
            double squaredBaseline = 0;
            double logLoss = 0;
            int pairs = 0;
            for (LotteryKl8JevNumberProbability item : result.numbers()) {
                double probability = item.probability();
                double observed = actualNumbers.contains(item.number()) ? 1.0 : 0.0;
                double baseline = LotteryKl8JevProbabilityService.BASELINE_PROBABILITY;
                squaredJev += (probability - observed) * (probability - observed);
                squaredBaseline += (baseline - observed) * (baseline - observed);
                logLoss += logLoss(probability, observed);
                probabilitySum += probability;
                if (observed > 0) {
                    totalHits += 1;
                }
                pairs += 1;
            }
            if (pairs == 0) {
                log.warn("第 {} 期 Jev 未返回号码概率，已跳过该期", target.getIssueNo());
                continue;
            }
            issueDiffs.add(squaredJev / pairs - squaredBaseline / pairs);
            totalSquaredJev += squaredJev;
            totalSquaredBaseline += squaredBaseline;
            totalLogLoss += logLoss;
            totalPairs += pairs;
        }

        if (issueDiffs.isEmpty()) {
            throw new BusinessException(500, "Jev 未返回任何号码概率，校准无法进行");
        }
        return assembleReport(issueDiffs, totalSquaredJev, totalSquaredBaseline, totalLogLoss,
                probabilitySum, totalPairs, totalHits, baseToUse, modelVersions,
                totalLatencyMs, totalInputTokens);
    }

    /**
     * 统计并生成校准报告。
     *
     * @param issueDiffs           逐期 Brier 差值
     * @param totalSquaredJev      全部样本的 Jev 平方误差和
     * @param totalSquaredBaseline 全部样本的基线平方误差和
     * @param totalLogLoss         全部样本的对数损失和
     * @param probabilitySum       全部样本的概率和
     * @param totalPairs           样本对数量
     * @param totalHits            实际命中样本数
     * @param baseIssueCount       构建报告所用的历史期数
     * @param modelVersions        参与回答的模型版本
     * @param totalLatencyMs       累计耗时
     * @param totalInputTokens     累计输入 token
     * @return 校准报告
     */
    private LotteryKl8JevCalibrationReport assembleReport(
            List<Double> issueDiffs,
            double totalSquaredJev,
            double totalSquaredBaseline,
            double totalLogLoss,
            double probabilitySum,
            int totalPairs,
            int totalHits,
            int baseIssueCount,
            Set<String> modelVersions,
            long totalLatencyMs,
            long totalInputTokens) {
        int issueCount = issueDiffs.size();
        double brierJev = totalSquaredJev / totalPairs;
        double brierBaseline = totalSquaredBaseline / totalPairs;
        double brierDelta = brierJev - brierBaseline;
        double logLossJev = totalLogLoss / totalPairs;
        double meanProbability = probabilitySum / totalPairs;
        double observedHitRate = (double) totalHits / totalPairs;

        // 闸门判定交给纯统计工具，便于单元测试直接覆盖判定逻辑
        JevCalibrationStatistics.PairedTestResult test = JevCalibrationStatistics.oneSided95(issueDiffs);
        double meanDiff = test.mean();
        double stdDev = test.stdDev();
        double criticalValue = test.criticalValue();
        double tStatistic = test.tStatistic();
        double pValue = test.pValue();
        boolean passedGate = test.passed();
        Integer requiredIssues = passedGate
                ? null
                : JevCalibrationStatistics.requiredIssues(meanDiff, stdDev);
        return new LotteryKl8JevCalibrationReport(
                issueCount,
                totalPairs,
                baseIssueCount,
                List.copyOf(modelVersions),
                round(brierJev),
                round(brierBaseline),
                round(brierDelta),
                round(logLossJev),
                round(meanProbability),
                round(observedHitRate),
                round(meanDiff),
                round(stdDev),
                round(tStatistic),
                round(criticalValue),
                round(pValue),
                passedGate,
                requiredIssues,
                issueCount == 0 ? 0 : totalLatencyMs / issueCount,
                totalInputTokens,
                verdict(issueCount, brierDelta, meanProbability, observedHitRate, passedGate, pValue),
                warnings(passedGate, brierDelta, issueCount, requiredIssues));
    }

    /**
     * 生成中文结论。
     *
     * @param issueCount       评估期数
     * @param brierDelta       Brier 差值
     * @param meanProbability  概率均值
     * @param observedHitRate  实际命中率
     * @param passedGate       是否通过闸门
     * @param pValue           单侧 p 值
     * @return 中文结论
     */
    private String verdict(
            int issueCount,
            double brierDelta,
            double meanProbability,
            double observedHitRate,
            boolean passedGate,
            double pValue) {
        StringBuilder text = new StringBuilder();
        text.append("基于 %d 期走查前推校准：Jev 概率均值为 %.2f%%，实际命中率为 %.2f%%（理论值 25.00%%），"
                .formatted(issueCount, meanProbability * 100, observedHitRate * 100));
        text.append("Brier 差值 %.4f（负数表示优于 25%% 常数基线）。".formatted(brierDelta));
        if (passedGate) {
            text.append("Jev 概率在单侧 95% 置信下显著优于随机基线，闸门放行。"
                    + "但该结论依赖当前窗口，放行前建议扩大期数复验，并确认不是数据异常导致的假信号。");
        } else {
            text.append("未发现 Jev 概率优于随机基线的证据，闸门保持关闭，概率不得参与推荐排序。");
            text.append("这与快乐8独立同分布开奖的理论预期一致：单号真实概率恒为 25%%，模型无法改变它。");
            if (Math.abs(brierDelta) < Math.abs(MEANINGFUL_BRIER_DELTA)) {
                text.append("当前 Brier 差值远小于具备真实判别力时的 %.4f 量级，说明模型没有判别力。"
                        .formatted(MEANINGFUL_BRIER_DELTA));
            }
        }
        return text.toString();
    }

    /**
     * 构造风险提示。
     *
     * @param passedGate    是否通过闸门
     * @param brierDelta    Brier 差值
     * @param issueCount    评估期数
     * @param requiredIssues 所需期数
     * @return 风险提示
     */
    private List<String> warnings(boolean passedGate, double brierDelta, int issueCount, Integer requiredIssues) {
        List<String> warnings = new ArrayList<>();
        warnings.add("校准样本期数为 %d，样本量偏小时结果波动大，不建议据此做长期结论。".formatted(issueCount));
        if (!passedGate) {
            warnings.add("闸门未放行：Jev 概率仅可用于观察与展示，不得影响推荐号码的生成。");
        }
        if (brierDelta > 0) {
            warnings.add("Jev 概率的 Brier 分数劣于常数 0.25 基线，说明其概率存在过度自信或与开奖无关的偏移。");
        }
        if (requiredIssues != null) {
            warnings.add("若当前方向成立，按现有波动水平约需 %d 期才能达到显著，届时可重新校准。"
                    .formatted(requiredIssues));
        }
        warnings.add("彩票开奖结果具有独立随机性，任何概率推算都不构成投注建议。");
        return List.copyOf(warnings);
    }

    /**
     * 加载最近若干期开奖记录，最新在前。
     *
     * @param limit 期数上限
     * @return 开奖记录
     */
    private List<LotteryKl8Draw> loadRecentDraws(int limit) {
        return drawMapper.selectList(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getDrawDate)
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT " + limit));
    }

    /**
     * 计算单个样本的对数损失。
     *
     * @param probability 预测概率
     * @param observed    实际结果，1 表示开出
     * @return 对数损失
     */
    private double logLoss(double probability, double observed) {
        double clipped = Math.max(LOG_LOSS_CLIP_LOW, Math.min(LOG_LOSS_CLIP_HIGH, probability));
        return observed > 0 ? -Math.log(clipped) : -Math.log(1 - clipped);
    }

    /**
     * 保留四位小数。
     *
     * @param value 原始值
     * @return 四舍五入后的值
     */
    private double round(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return value;
        }
        return Math.round(value * 10000.0) / 10000.0;
    }
}
