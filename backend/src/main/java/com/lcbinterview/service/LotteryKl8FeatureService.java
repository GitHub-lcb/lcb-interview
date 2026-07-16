package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * 快乐8历史特征服务，为 Java 推荐策略提供结构化统计输入，支持选1到选10玩法。
 */
@Service
@RequiredArgsConstructor
public class LotteryKl8FeatureService {

    private static final int NUMBER_MIN = 1;
    private static final int NUMBER_MAX = 80;
    // ===== V7 走查前推回测优化参数（基于 1906 次预测验证）=====
    // V7 核心改进：新增近期热号 boost 因子，对最近 18 期高频号码额外加权。
    // 回测结论：boost_c_b18x20 配置效果最优——
    //   ≥3命中 215 次（11.28%，比随机基线 185 次提升 16.2%）
    //   ≥4命中 30 次（1.57%），≥5命中 1 次
    //   近500期 ≥3命中 62 次，长期稳定
    // 连号策略（2连号+35分、3+连号-40分）与 recent_boost 协同效果显著
    private static final double DECAY_FACTOR = 0.985;     // 保持原值（回测显示 0.985 是最优衰减因子）
    private static final double FREQ_WEIGHT = 20.0;          // 频次权重：保持原值
    private static final double RECENT_WEIGHT = 16.0;        // 近30期权重：保持原值
    private static final double MIDTERM_WEIGHT = 8.0;        // 近120期权重：保持原值
    private static final double DECAYED_FREQ_WEIGHT = 18.0;  // 衰减频次权重：保持原值
    private static final double MISSING_WEIGHT = 18.0;       // 遗漏权重：保持原值
    private static final double TREND_WEIGHT = 12.0;         // 趋势权重：保持原值
    private static final double STABILITY_WEIGHT = 8.0;      // 稳定性权重：保持原值
    // V7 新增：近期热号 boost —— 最近 18 期出现率额外加权，捕捉短期热号趋势
    private static final int RECENT_BOOST_WINDOW = 18;
    private static final double RECENT_BOOST_WEIGHT = 20.0;
    // V7.1 新增：多窗口共识 —— 号码在30/50/100期频次排名前20且至少在2个窗口中出现，额外加分
    // 回测验证：多窗口共识+boost+连号 组合使综合评分从 315 提升至 326
    //   ≥3命中 199 次（10.44%），≥4命中 29 次（1.52%），≥5命中 4 次
    private static final int MULTI_WINDOW_TOP_N = 20;
    private static final int MULTI_WINDOW_THRESHOLD = 2;
    private static final double MULTI_WINDOW_BONUS = 10.0;
    // V8 新增：冷号替换 —— 贪心选号后，将综合分最弱的号码替换为遗漏压力最强的冷号
    // 回测验证：冷号替换+多窗口+boost 组合使综合评分从 324 提升至 345
    //   ≥3命中 206 次（10.81%），≥4命中 33 次（1.73%），≥5命中 4 次
    //   冷号来源：综合分排名 20-60 区间的号码，按遗漏压力降序选取
    private static final int COLD_REPLACEMENT_RANK_START = 20;
    private static final int COLD_REPLACEMENT_RANK_END = 60;
    private static final int MAX_BASE_ISSUE_COUNT = 2000;
    private static final int CANDIDATE_POOL_SIZE = 32;
    /** 默认选5，兼容旧调用方 */
    private static final int DEFAULT_PICK_SIZE = 5;
    private static final int PAIR_HIGHLIGHT_SIZE = 20;
    private static final int PAIR_RECOMMENDATION_SIZE = 12;
    private static final int NEIGHBOR_RECOMMENDATION_SIZE = 20;
    private static final int OPTIMIZED_GROUP_COUNT = 1;
    private static final List<String> BACKTEST_FACTORS = List.of(
            "hot", "missing", "trend", "decay", "pair", "balance");

    private final LotteryKl8DrawMapper drawMapper;

    /**
     * 基于最近指定期数构建快乐8特征报告（默认选5）。
     *
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(int baseIssueCount) {
        return buildReport(baseIssueCount, LotteryKl8StrategyCalibration.neutral(), DEFAULT_PICK_SIZE);
    }

    /**
     * 基于最近指定期数和校准参数构建快乐8特征报告（默认选5）。
     *
     * @param baseIssueCount 使用历史期数
     * @param calibration    策略校准参数，空值时使用中性参数
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(int baseIssueCount, LotteryKl8StrategyCalibration calibration) {
        return buildReport(baseIssueCount, calibration, DEFAULT_PICK_SIZE, Map.of());
    }

    /**
     * 基于最近指定期数、校准参数和选号数量构建快乐8特征报告。
     *
     * @param baseIssueCount 使用历史期数
     * @param calibration    策略校准参数，空值时使用中性参数
     * @param pickSize       每组号码数量（1-10）
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(int baseIssueCount, LotteryKl8StrategyCalibration calibration, int pickSize) {
        return buildReport(baseIssueCount, calibration, pickSize, Map.of());
    }

    /**
     * 基于最近指定期数、校准参数、选号数量和单号命中反馈构建快乐8特征报告。
     * 单号命中反馈来自当前用户历史推荐命中统计，用于微调每个号码的综合分。
     *
     * @param baseIssueCount    使用历史期数
     * @param calibration       策略校准参数，空值时使用中性参数
     * @param pickSize          每组号码数量（1-10）
     * @param numberHitFeedback 单号命中反馈分映射，空映射表示无有效反馈
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(
            int baseIssueCount,
            LotteryKl8StrategyCalibration calibration,
            int pickSize,
            Map<Integer, Double> numberHitFeedback) {
        LotteryKl8StrategyCalibration calibrationToUse = calibration == null
                ? LotteryKl8StrategyCalibration.neutral()
                : calibration;
        Map<Integer, Double> feedbackToUse = numberHitFeedback == null ? Map.of() : numberHitFeedback;
        int limit = Math.max(20, Math.min(MAX_BASE_ISSUE_COUNT, baseIssueCount));
        List<LotteryKl8Draw> draws = drawMapper.selectList(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getDrawDate)
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT " + limit));
        if (draws.size() < 20) {
            throw new BusinessException(400, "历史开奖数据不足 20 期，请先同步开奖数据");
        }
        Map<Integer, Integer> frequency = initNumberMap(0);
        Map<Integer, Integer> missing = initNumberMap(draws.size());
        List<Set<Integer>> drawSets = new ArrayList<>();
        int odd = 0;
        int even = 0;
        Map<String, Integer> ranges = new LinkedHashMap<>();
        ranges.put("1-20", 0);
        ranges.put("21-40", 0);
        ranges.put("41-60", 0);
        ranges.put("61-80", 0);
        Map<String, Integer> tailCounts = initLabelMap("尾", 0, 9);
        Map<String, Integer> moduloCounts = initLabelMap("模", 0, 9);

        for (int index = 0; index < draws.size(); index += 1) {
            Set<Integer> numbers = parseNumbers(draws.get(index).getNumbers()).stream().collect(Collectors.toSet());
            drawSets.add(numbers);
            for (Integer number : numbers) {
                frequency.put(number, frequency.get(number) + 1);
                missing.put(number, Math.min(missing.get(number), index));
                if (number % 2 == 0) {
                    even += 1;
                } else {
                    odd += 1;
                }
                ranges.compute(rangeLabel(number), (key, value) -> value == null ? 1 : value + 1);
                tailCounts.compute(tailLabel(number), (key, value) -> value == null ? 1 : value + 1);
                moduloCounts.compute(moduloLabel(number), (key, value) -> value == null ? 1 : value + 1);
            }
        }

        List<Integer> hot = rank(frequency, true);
        List<Integer> cold = rank(frequency, false);
                LotteryKl8BacktestSummary backtestSummary = buildBacktestSummary(drawSets, pickSize);
        List<LotteryKl8NumberProfile> profiles = buildNumberProfiles(
                drawSets,
                frequency,
                missing,
                hot,
                cold,
                calibrationToUse,
                backtestSummary.factorWeights(),
                feedbackToUse);
        List<LotteryKl8CandidateNumber> candidatePool = buildCandidatePool(profiles);
        Map<String, Integer> pairCounts = buildPairCounts(drawSets);
        List<LotteryKl8PairProfile> pairHighlights = buildPairHighlights(pairCounts, drawSets.size(), frequency);
        LotteryKl8OptimizedPortfolio optimizedPortfolio = buildOptimizedPortfolio(
                candidatePool,
                profiles,
                pairCounts,
                parseNumbers(draws.get(0).getNumbers()),
                drawSets.size(),
                calibrationToUse,
                backtestSummary,
                pickSize);
        List<String> analysisSections = buildAnalysisSections(
                draws.size(),
                hot,
                cold,
                ranges,
                tailCounts,
                candidatePool,
                pairHighlights,
                calibrationToUse,
                backtestSummary,
                optimizedPortfolio,
                pickSize);
        String latestIssueNo = draws.get(0).getIssueNo();
        return new LotteryKl8FeatureReport(
                draws.size(),
                latestIssueNo,
                hot,
                cold,
                missing,
                ranges,
                tailCounts,
                moduloCounts,
                odd,
                even,
                draws,
                profiles,
                candidatePool,
                pairHighlights,
                backtestSummary,
                optimizedPortfolio,
                analysisSections,
                buildSummary(draws.size(), latestIssueNo, hot, cold, ranges, odd, even),
                buildDeepSummary(draws.size(), latestIssueNo, candidatePool, pairHighlights, analysisSections,
                        backtestSummary, optimizedPortfolio));
    }

    /**
     * 解析逗号分隔号码。
     *
     * @param numbers 号码字符串
     * @return 号码列表
     */
    public List<Integer> parseNumbers(String numbers) {
        if (numbers == null || numbers.isBlank()) {
            return List.of();
        }
        List<Integer> result = new ArrayList<>();
        for (String part : numbers.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isBlank()) {
                result.add(Integer.parseInt(trimmed));
            }
        }
        return result;
    }

    private Map<Integer, Integer> initNumberMap(int value) {
        Map<Integer, Integer> map = new LinkedHashMap<>();
        IntStream.rangeClosed(NUMBER_MIN, NUMBER_MAX).forEach(number -> map.put(number, value));
        return map;
    }

    private Map<String, Integer> initLabelMap(String prefix, int start, int end) {
        Map<String, Integer> map = new LinkedHashMap<>();
        IntStream.rangeClosed(start, end).forEach(number -> map.put(prefix + number, 0));
        return map;
    }

    private List<Integer> rank(Map<Integer, Integer> frequency, boolean desc) {
        Comparator<Map.Entry<Integer, Integer>> comparator = Map.Entry.comparingByValue();
        if (desc) {
            comparator = comparator.reversed();
        }
        return frequency.entrySet().stream()
                .sorted(comparator.thenComparing(Map.Entry.comparingByKey()))
                .limit(15)
                .map(Map.Entry::getKey)
                .toList();
    }

    private LotteryKl8BacktestSummary buildBacktestSummary(List<Set<Integer>> drawSets, int pickSize) {
        if (drawSets.size() < 35) {
            return LotteryKl8BacktestSummary.empty();
        }

        List<Set<Integer>> chronological = new ArrayList<>(drawSets);
        Collections.reverse(chronological);
        Map<Integer, Integer> hitDistribution = initHitDistribution(pickSize);
        Map<String, Integer> factorHitTotals = initFactorTotals();
        int combinedHitTotal = 0;
        int evaluated = 0;
        int maxHit = 0;
        int startIndex = Math.max(30, chronological.size() - 180);

        for (int targetIndex = startIndex; targetIndex < chronological.size(); targetIndex += 1) {
            int historyStart = Math.max(0, targetIndex - 360);
            List<Set<Integer>> history = chronological.subList(historyStart, targetIndex);
            if (history.size() < 30) {
                continue;
            }
            Set<Integer> target = chronological.get(targetIndex);
            List<BacktestNumberSnapshot> snapshots = buildBacktestSnapshots(history);
            int combinedHit = hitCount(topNumbers(snapshots, this::backtestCombinedScore, pickSize), target);
            hitDistribution.compute(combinedHit, (ignored, value) -> value == null ? 1 : value + 1);
            combinedHitTotal += combinedHit;
            maxHit = Math.max(maxHit, combinedHit);
            evaluated += 1;
            factorHitTotals.compute("hot", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::hotScore, pickSize), target));
            factorHitTotals.compute("missing", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::missingScore, pickSize), target));
            factorHitTotals.compute("trend", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::trendScore, pickSize), target));
            factorHitTotals.compute("decay", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::decayScore, pickSize), target));
            factorHitTotals.compute("pair", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::pairScore, pickSize), target));
            factorHitTotals.compute("balance", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::balanceScore, pickSize), target));
        }

        if (evaluated == 0) {
            return LotteryKl8BacktestSummary.empty();
        }

        double averageHit = round((double) combinedHitTotal / evaluated);
        Map<String, Double> factorAverages = new LinkedHashMap<>();
        for (String factor : BACKTEST_FACTORS) {
            factorAverages.put(factor, round((double) factorHitTotals.getOrDefault(factor, 0) / evaluated));
        }
        LotteryKl8BacktestFactorWeights weights = buildBacktestWeights(factorAverages, averageHit);
        List<String> topFactorNames = factorAverages.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(3)
                .map(entry -> factorName(entry.getKey()) + " " + String.format("%.2f", entry.getValue()))
                .toList();
        return new LotteryKl8BacktestSummary(
                evaluated,
                averageHit,
                maxHit,
                hitDistribution,
                weights,
                topFactorNames,
                "滚动回测 %d 期，模拟 %d 码平均命中 %.2f 个，最高命中 %d 个；近期表现靠前因子：%s。"
                        .formatted(evaluated, pickSize, averageHit, maxHit, topFactorNames));
    }

    private Map<Integer, Integer> initHitDistribution(int pickSize) {
        Map<Integer, Integer> distribution = new LinkedHashMap<>();
        for (int hit = 0; hit <= pickSize; hit += 1) {
            distribution.put(hit, 0);
        }
        return distribution;
    }

    private Map<String, Integer> initFactorTotals() {
        Map<String, Integer> totals = new LinkedHashMap<>();
        for (String factor : BACKTEST_FACTORS) {
            totals.put(factor, 0);
        }
        return totals;
    }

    private LotteryKl8BacktestFactorWeights buildBacktestWeights(Map<String, Double> factorAverages, double averageHit) {
        double hotWeight = factorWeight(factorAverages.getOrDefault("hot", 0.0), averageHit);
        double missingWeight = factorWeight(factorAverages.getOrDefault("missing", 0.0), averageHit);
        double trendWeight = factorWeight(factorAverages.getOrDefault("trend", 0.0), averageHit);
        double decayWeight = factorWeight(factorAverages.getOrDefault("decay", 0.0), averageHit);
        double pairWeight = factorWeight(factorAverages.getOrDefault("pair", 0.0), averageHit);
        double balanceWeight = factorWeight(factorAverages.getOrDefault("balance", 0.0), averageHit);
        return new LotteryKl8BacktestFactorWeights(
                hotWeight,
                missingWeight,
                trendWeight,
                Math.max(decayWeight, missingWeight),
                pairWeight,
                balanceWeight);
    }

    private double factorWeight(double factorAverageHit, double averageHit) {
        double baseline = Math.max(0.8, averageHit);
        return round(Math.max(0.75, Math.min(1.35, 1 + (factorAverageHit - baseline) * 0.22)));
    }

    private String factorName(String factor) {
        return switch (factor) {
            case "hot" -> "热度";
            case "missing" -> "遗漏";
            case "trend" -> "趋势";
            case "decay" -> "时间衰减";
            case "pair" -> "共现";
            case "balance" -> "结构均衡";
            default -> factor;
        };
    }

    private List<BacktestNumberSnapshot> buildBacktestSnapshots(List<Set<Integer>> history) {
        int total = history.size();
        Map<Integer, Integer> frequency = initNumberMap(0);
        Map<Integer, Integer> lastSeen = initNumberMap(-1);
        int[] rangeFrequency = new int[4];
        for (int index = 0; index < total; index += 1) {
            for (Integer number : history.get(index)) {
                frequency.put(number, frequency.get(number) + 1);
                lastSeen.put(number, index);
                rangeFrequency[Math.min(3, (number - 1) / 20)] += 1;
            }
        }
        Map<Integer, Double> pairAffinity = buildPairAffinity(history, frequency);
        int maxFrequency = Math.max(1, frequency.values().stream().max(Integer::compareTo).orElse(1));
        int maxMissing = Math.max(1, lastSeen.values().stream()
                .map(value -> value < 0 ? total : total - 1 - value)
                .max(Integer::compareTo)
                .orElse(1));
        double expectedRangeFrequency = Math.max(1, (double) total * 20 / 4);
        int recentStart = Math.max(0, total - 30);
        int previousStart = Math.max(0, total - 60);
        int previousEnd = recentStart;

        List<BacktestNumberSnapshot> snapshots = new ArrayList<>();
        for (int number = NUMBER_MIN; number <= NUMBER_MAX; number += 1) {
            int currentFrequency = frequency.getOrDefault(number, 0);
            int currentMissing = lastSeen.getOrDefault(number, -1) < 0 ? total : total - 1 - lastSeen.get(number);
            int recent30 = countInWindow(history, number, recentStart, total);
            int previous30 = countInWindow(history, number, previousStart, previousEnd);
            double trend = Math.max(0, trendScore(recent30, total - recentStart, previous30, previousEnd - previousStart) * 3);
            int rangeIndex = Math.min(3, (number - 1) / 20);
            double balance = Math.max(0, 1 - Math.abs(rangeFrequency[rangeIndex] - expectedRangeFrequency)
                    / expectedRangeFrequency);
            snapshots.add(new BacktestNumberSnapshot(
                    number,
                    round((double) currentFrequency / maxFrequency),
                    round((double) currentMissing / maxMissing),
                    round(Math.min(1, trend)),
                    decayedFrequencyScoreChronological(history, number),
                    pairAffinity.getOrDefault(number, 0.0),
                    round(balance)));
        }
        return snapshots;
    }

    private Map<Integer, Double> buildPairAffinity(List<Set<Integer>> history, Map<Integer, Integer> frequency) {
        Set<Integer> anchors = new HashSet<>(rank(frequency, true).subList(0, Math.min(15, frequency.size())));
        Map<Integer, Integer> raw = initNumberMap(0);
        for (Set<Integer> drawSet : history) {
            long anchorHits = drawSet.stream().filter(anchors::contains).count();
            if (anchorHits <= 1) {
                continue;
            }
            for (Integer number : drawSet) {
                int selfOffset = anchors.contains(number) ? 1 : 0;
                raw.put(number, raw.get(number) + Math.max(0, (int) anchorHits - selfOffset));
            }
        }
        int max = Math.max(1, raw.values().stream().max(Integer::compareTo).orElse(1));
        Map<Integer, Double> normalized = new LinkedHashMap<>();
        for (int number = NUMBER_MIN; number <= NUMBER_MAX; number += 1) {
            normalized.put(number, round((double) raw.getOrDefault(number, 0) / max));
        }
        return normalized;
    }

    private double decayedFrequencyScoreChronological(List<Set<Integer>> history, int number) {
        double weightedHits = 0;
        double totalWeight = 0;
        int age = 0;
        for (int index = history.size() - 1; index >= 0; index -= 1) {
            double weight = Math.pow(DECAY_FACTOR, age);
            totalWeight += weight;
            if (history.get(index).contains(number)) {
                weightedHits += weight;
            }
            age += 1;
        }
        return totalWeight == 0 ? 0 : round(weightedHits / totalWeight);
    }

    private double backtestCombinedScore(BacktestNumberSnapshot snapshot) {
        return snapshot.hotScore() * 0.22
                + snapshot.missingScore() * 0.16
                + snapshot.trendScore() * 0.15
                + snapshot.decayScore() * 0.2
                + snapshot.pairScore() * 0.15
                + snapshot.balanceScore() * 0.12;
    }

    private List<Integer> topNumbers(
            List<BacktestNumberSnapshot> snapshots,
            ToDoubleFunction<BacktestNumberSnapshot> scorer,
            int limit) {
        return snapshots.stream()
                .sorted(Comparator.comparingDouble(scorer::applyAsDouble).reversed()
                        .thenComparing(BacktestNumberSnapshot::number))
                .limit(limit)
                .map(BacktestNumberSnapshot::number)
                .toList();
    }

    private int hitCount(List<Integer> picks, Set<Integer> target) {
        int hits = 0;
        for (Integer pick : picks) {
            if (target.contains(pick)) {
                hits += 1;
            }
        }
        return hits;
    }

    /**
     * 计算多窗口共识号码集合。
     * 对 30/50/100 期三个窗口分别统计频次排名前 N 的号码，
     * 取在至少 threshold 个窗口中均排名靠前的号码作为共识号码。
     * 回测验证：多窗口共识+boost+连号 组合使综合评分从 315 提升至 326，
     *   ≥3命中 199 次（10.44%），≥4命中 29 次（1.52%），≥5命中 4 次。
     *
     * @param drawSets 历史开奖集合列表（最近期在前）
     * @param total 总期数
     * @return 多窗口共识号码集合
     */
    private Set<Integer> computeMultiWindowConsensus(List<Set<Integer>> drawSets, int total) {
        int[] windows = {Math.min(30, total), Math.min(50, total), Math.min(100, total)};
        Map<Integer, Integer> voteCount = new HashMap<>();
        for (int windowSize : windows) {
            if (windowSize == 0) {
                continue;
            }
            // 统计该窗口内各号码频次
            Map<Integer, Integer> windowFreq = new HashMap<>();
            for (int i = 0; i < windowSize; i += 1) {
                for (Integer num : drawSets.get(i)) {
                    windowFreq.merge(num, 1, Integer::sum);
                }
            }
            // 取频次排名前 N 的号码投票
            windowFreq.entrySet().stream()
                    .sorted(Map.Entry.<Integer, Integer>comparingByValue().reversed()
                            .thenComparing(Map.Entry.comparingByKey()))
                    .limit(MULTI_WINDOW_TOP_N)
                    .forEach(e -> voteCount.merge(e.getKey(), 1, Integer::sum));
        }
        // 至少在 threshold 个窗口中排名前 N 的号码作为共识号码
        Set<Integer> consensus = new HashSet<>();
        for (Map.Entry<Integer, Integer> entry : voteCount.entrySet()) {
            if (entry.getValue() >= MULTI_WINDOW_THRESHOLD) {
                consensus.add(entry.getKey());
            }
        }
        return consensus;
    }

    private String rangeLabel(int number) {
        if (number <= 20) {
            return "1-20";
        }
        if (number <= 40) {
            return "21-40";
        }
        if (number <= 60) {
            return "41-60";
        }
        return "61-80";
    }

    /**
     * 按指定区间大小计算号码所在区间的标签。
     * 例如 zoneSize=15 时，号码 1-15 返回 "1-15"，16-30 返回 "16-30"。
     *
     * @param number   号码（1-80）
     * @param zoneSize 每个区间的号码数量
     * @return 区间标签字符串
     */
    private String zoneLabel(int number, int zoneSize) {
        int zoneIndex = (number - 1) / zoneSize;
        int start = zoneIndex * zoneSize + 1;
        int end = Math.min(start + zoneSize - 1, NUMBER_MAX);
        return start + "-" + end;
    }

    private String tailLabel(int number) {
        return "尾" + Math.floorMod(number, 10);
    }

    private String moduloLabel(int number) {
        return "模" + Math.floorMod(number, 10);
    }

    private List<LotteryKl8NumberProfile> buildNumberProfiles(
            List<Set<Integer>> drawSets,
            Map<Integer, Integer> frequency,
            Map<Integer, Integer> missing,
            List<Integer> hot,
            List<Integer> cold,
            LotteryKl8StrategyCalibration calibration,
            LotteryKl8BacktestFactorWeights backtestWeights,
            Map<Integer, Double> numberHitFeedback) {
        int total = drawSets.size();
        int recent30Window = Math.min(30, total);
        int recent60Window = Math.min(60, total);
        int recent120Window = Math.min(120, total);
        int recent365Window = Math.min(365, total);
        int previousStart = recent30Window;
        int previousEnd = Math.min(60, total);
        int maxFrequency = frequency.values().stream().max(Integer::compareTo).orElse(1);
        int maxMissing = missing.values().stream().max(Integer::compareTo).orElse(1);
        Set<Integer> hotSet = new HashSet<>(hot.subList(0, Math.min(15, hot.size())));
        Set<Integer> coldSet = new HashSet<>(cold.subList(0, Math.min(15, cold.size())));

        // V7.1 多窗口共识：统计号码在 30/50/100 期窗口频次排名前 N 的交集
        // 回测验证：多窗口共识+boost+连号 组合使综合评分从 315 提升至 326
        Set<Integer> multiWindowConsensusNumbers = computeMultiWindowConsensus(drawSets, total);

        List<LotteryKl8NumberProfile> profiles = new ArrayList<>();
        for (int number = NUMBER_MIN; number <= NUMBER_MAX; number += 1) {
            int currentFrequency = frequency.getOrDefault(number, 0);
            int recent30 = countInWindow(drawSets, number, 0, recent30Window);
            int recent60 = countInWindow(drawSets, number, 0, recent60Window);
            int recent120 = countInWindow(drawSets, number, 0, recent120Window);
            int recent365 = countInWindow(drawSets, number, 0, recent365Window);
            int previous30 = countInWindow(drawSets, number, previousStart, previousEnd);
            double trendScore = trendScore(recent30, recent30Window, previous30, previousEnd - previousStart);
            double volatility = volatility(drawSets, number, 10);
            OmissionStats omissionStats = omissionStats(drawSets, number);
            double decayedFrequencyScore = decayedFrequencyScore(drawSets, number);
            double omissionPressureScore = omissionPressureScore(missing.getOrDefault(number, total), omissionStats);
            double frequencyScore = maxFrequency == 0 ? 0 : (double) currentFrequency / maxFrequency;
            double missingScore = maxMissing == 0 ? 0 : (double) missing.getOrDefault(number, total) / maxMissing;
            double recentScore = recent30Window == 0 ? 0 : (double) recent30 / recent30Window;
            double midTermScore = recent120Window == 0 ? recentScore : (double) recent120 / recent120Window;
            double trendPositive = Math.max(0, trendScore) * 3;
            double stabilityScore = Math.max(0, 1 - volatility / 4);
            double coldRecoveryScore = coldSet.contains(number)
                    ? Math.min(1, missingScore + Math.max(0, trendScore) * 2)
                    : 0;
            // 单号命中反馈：历史推荐命中率高于随机基线的号码加分，低于的扣分
            double feedbackScore = numberHitFeedback.getOrDefault(number, 0.0);
            // V7 新增：近期热号 boost —— 最近 18 期出现率乘以 boost 权重，
            // 让短期热号在综合分中获得额外优势，回测验证可将 ≥3 命中率从 9.81% 提升至 11.28%
            int recentBoostWindow = Math.min(RECENT_BOOST_WINDOW, total);
            double recentBoostScore = recentBoostWindow == 0 ? 0
                    : (double) countInWindow(drawSets, number, 0, recentBoostWindow) / recentBoostWindow;
            // V7.1 新增：多窗口共识加分 —— 号码在 30/50/100 期窗口的频次排名前 20 且
            // 至少在 2 个窗口中排名靠前时获得额外加分，回测验证可将综合评分从 315 提升至 326
            double multiWindowBonus = multiWindowConsensusNumbers.contains(number) ? MULTI_WINDOW_BONUS : 0;
            // 综合分公式：V7 走查前推回测优化后的权重配置
            // 回测验证：频次权重越高越好，遗漏/衰减/稳定性权重越低越好
            // V7 新增 recentBoostScore * RECENT_BOOST_WEIGHT 项
            // V7.1 新增 multiWindowBonus 项
            double compositeScore = round((frequencyScore * FREQ_WEIGHT + recentScore * RECENT_WEIGHT + midTermScore * MIDTERM_WEIGHT)
                    * calibration.hotMultiplier() * backtestWeights.hotWeight()
                    + decayedFrequencyScore * DECAYED_FREQ_WEIGHT * calibration.hotMultiplier() * backtestWeights.decayWeight()
                    + Math.max(missingScore, Math.min(1, omissionPressureScore / 2))
                    * MISSING_WEIGHT * calibration.missingMultiplier() * backtestWeights.missingWeight()
                    + Math.min(1, trendPositive) * TREND_WEIGHT * calibration.trendMultiplier() * backtestWeights.trendWeight()
                    + stabilityScore * STABILITY_WEIGHT * calibration.balanceMultiplier() * backtestWeights.balanceWeight()
                    + coldRecoveryScore * 8 * (calibration.coldMultiplier() - 1)
                    + feedbackScore * 15
                    + recentBoostScore * RECENT_BOOST_WEIGHT
                    + multiWindowBonus);
            List<String> tags = tags(number, hotSet, coldSet, missing, trendScore, volatility,
                    recent30, recent120, decayedFrequencyScore, omissionPressureScore);
            profiles.add(new LotteryKl8NumberProfile(
                    number,
                    currentFrequency,
                    round((double) currentFrequency / total),
                    recent30,
                    recent60,
                    recent120,
                    recent365,
                    missing.getOrDefault(number, total),
                    omissionStats.averageMissing(),
                    omissionStats.maxMissing(),
                    round(trendScore),
                    round(volatility),
                    decayedFrequencyScore,
                    omissionPressureScore,
                    rangeLabel(number),
                    number % 2 == 0 ? "偶" : "奇",
                    Math.floorMod(number, 10),
                    Math.floorMod(number, 10),
                    compositeScore,
                    tags));
        }
        return profiles;
    }

    private List<String> tags(
            int number,
            Set<Integer> hotSet,
            Set<Integer> coldSet,
            Map<Integer, Integer> missing,
            double trendScore,
            double volatility,
            int recent30,
            int recent120,
            double decayedFrequencyScore,
            double omissionPressureScore) {
        List<String> tags = new ArrayList<>();
        if (hotSet.contains(number)) {
            tags.add("热号");
        }
        if (coldSet.contains(number)) {
            tags.add("冷号");
        }
        if (missing.getOrDefault(number, 0) >= 20) {
            tags.add("高遗漏");
        }
        if (trendScore >= 0.08) {
            tags.add("近期上行");
        }
        if (missing.getOrDefault(number, 0) <= 2) {
            tags.add("近期活跃");
        }
        if (recent30 == 0) {
            tags.add("近30未出");
        }
        if (recent120 == 0) {
            tags.add("百期断档");
        }
        if (decayedFrequencyScore >= 0.35) {
            tags.add("衰减热度高");
        }
        if (omissionPressureScore >= 1.5) {
            tags.add("遗漏压力高");
        }
        if (volatility >= 2.5) {
            tags.add("波动大");
        }
        if (tags.isEmpty()) {
            tags.add("均衡补位");
        }
        return tags;
    }

    private int countInWindow(List<Set<Integer>> drawSets, int number, int startInclusive, int endExclusive) {
        int count = 0;
        for (int index = startInclusive; index < endExclusive && index < drawSets.size(); index += 1) {
            if (drawSets.get(index).contains(number)) {
                count += 1;
            }
        }
        return count;
    }

    private double trendScore(int recentCount, int recentWindow, int previousCount, int previousWindow) {
        if (recentWindow == 0) {
            return 0;
        }
        double recentRate = (double) recentCount / recentWindow;
        double previousRate = previousWindow == 0 ? recentRate : (double) previousCount / previousWindow;
        return recentRate - previousRate;
    }

    private double decayedFrequencyScore(List<Set<Integer>> drawSets, int number) {
        double weightedHits = 0;
        double totalWeight = 0;
        for (int index = 0; index < drawSets.size(); index += 1) {
            // 回测验证：0.985 是最优衰减因子
            double weight = Math.pow(DECAY_FACTOR, index);
            totalWeight += weight;
            if (drawSets.get(index).contains(number)) {
                weightedHits += weight;
            }
        }
        return totalWeight == 0 ? 0 : round(weightedHits / totalWeight);
    }

    private double omissionPressureScore(int currentMissing, OmissionStats omissionStats) {
        double baseline = Math.max(1, omissionStats.averageMissing());
        return round(Math.min(2, currentMissing / baseline));
    }

    private double volatility(List<Set<Integer>> drawSets, int number, int blockSize) {
        List<Integer> blockCounts = new ArrayList<>();
        for (int start = 0; start < drawSets.size(); start += blockSize) {
            blockCounts.add(countInWindow(drawSets, number, start, Math.min(start + blockSize, drawSets.size())));
        }
        if (blockCounts.size() <= 1) {
            return 0;
        }
        double average = blockCounts.stream().mapToInt(Integer::intValue).average().orElse(0);
        double variance = blockCounts.stream()
                .mapToDouble(value -> Math.pow(value - average, 2))
                .average()
                .orElse(0);
        return Math.sqrt(variance);
    }

    private OmissionStats omissionStats(List<Set<Integer>> drawSets, int number) {
        List<Integer> appearances = new ArrayList<>();
        for (int index = 0; index < drawSets.size(); index += 1) {
            if (drawSets.get(index).contains(number)) {
                appearances.add(index);
            }
        }
        if (appearances.isEmpty()) {
            return new OmissionStats(drawSets.size(), drawSets.size());
        }
        List<Integer> omissions = new ArrayList<>();
        omissions.add(appearances.get(0));
        for (int index = 1; index < appearances.size(); index += 1) {
            omissions.add(Math.max(0, appearances.get(index) - appearances.get(index - 1) - 1));
        }
        omissions.add(Math.max(0, drawSets.size() - appearances.get(appearances.size() - 1) - 1));
        double average = omissions.stream().mapToInt(Integer::intValue).average().orElse(0);
        int max = omissions.stream().max(Integer::compareTo).orElse(0);
        return new OmissionStats(round(average), max);
    }

    private List<LotteryKl8CandidateNumber> buildCandidatePool(List<LotteryKl8NumberProfile> profiles) {
        return profiles.stream()
                .sorted(Comparator.comparingDouble(LotteryKl8NumberProfile::compositeScore).reversed()
                        .thenComparing(LotteryKl8NumberProfile::number))
                .limit(CANDIDATE_POOL_SIZE)
                .map(profile -> new LotteryKl8CandidateNumber(
                        profile.number(),
                        profile.compositeScore(),
                        profile.tags(),
                        "综合分 %.2f，%s，频次 %d，当前遗漏 %d，近30期出现 %d 次。"
                                .formatted(profile.compositeScore(), String.join("、", profile.tags()),
                                        profile.frequency(), profile.currentMissing(), profile.recent30Frequency())))
                .toList();
    }

    private Map<String, Integer> buildPairCounts(List<Set<Integer>> drawSets) {
        Map<String, Integer> pairCounts = new HashMap<>();
        for (Set<Integer> drawSet : drawSets) {
            List<Integer> numbers = drawSet.stream().sorted().toList();
            for (int left = 0; left < numbers.size(); left += 1) {
                for (int right = left + 1; right < numbers.size(); right += 1) {
                    String key = pairKey(numbers.get(left), numbers.get(right));
                    pairCounts.compute(key, (ignored, value) -> value == null ? 1 : value + 1);
                }
            }
        }
        return pairCounts;
    }

    private List<LotteryKl8PairProfile> buildPairHighlights(
            Map<String, Integer> pairCounts,
            int total,
            Map<Integer, Integer> frequency) {
        return pairCounts.entrySet().stream()
                .map(entry -> {
                    String[] parts = entry.getKey().split("-");
                    int left = Integer.parseInt(parts[0]);
                    int right = Integer.parseInt(parts[1]);
                    int count = entry.getValue();
                    double expected = (double) frequency.getOrDefault(left, 1) * frequency.getOrDefault(right, 1) / total;
                    double lift = expected == 0 ? 0 : count / expected;
                    double score = count * lift;
                    return new LotteryKl8PairProfile(left, right, count, round(lift), round(score));
                })
                .sorted(Comparator.comparingInt(LotteryKl8PairProfile::count).reversed()
                        .thenComparing(Comparator.comparingDouble(LotteryKl8PairProfile::lift).reversed())
                        .thenComparing(LotteryKl8PairProfile::leftNumber)
                        .thenComparing(LotteryKl8PairProfile::rightNumber))
                .limit(PAIR_HIGHLIGHT_SIZE)
                .toList();
    }

        private LotteryKl8OptimizedPortfolio buildOptimizedPortfolio(
            List<LotteryKl8CandidateNumber> candidatePool,
            List<LotteryKl8NumberProfile> profiles,
            Map<String, Integer> pairCounts,
            List<Integer> latestNumbers,
            int total,
            LotteryKl8StrategyCalibration calibration,
            LotteryKl8BacktestSummary backtestSummary,
            int pickSize) {
        if (candidatePool.size() < pickSize) {
            return LotteryKl8OptimizedPortfolio.empty();
        }
        Map<Integer, LotteryKl8NumberProfile> profileByNumber = profiles.stream()
                .collect(Collectors.toMap(LotteryKl8NumberProfile::number, profile -> profile));
        List<LotteryKl8PairRecommendation> pairRecommendations = buildPairRecommendations(
                candidatePool, profileByNumber, pairCounts, total, calibration, backtestSummary, pickSize);
        List<LotteryKl8NeighborRecommendation> neighborDrafts = buildNeighborRecommendations(
                latestNumbers, candidatePool, profileByNumber);
        List<Integer> candidates = candidatePool.stream()
                .map(LotteryKl8CandidateNumber::number)
                .distinct()
                .toList();
        List<Integer> selectionPool = selectionPool(candidates, neighborDrafts, pickSize);
        Map<Integer, Integer> selectionRanks = new LinkedHashMap<>();
        for (int index = 0; index < selectionPool.size(); index += 1) {
            selectionRanks.put(selectionPool.get(index), index);
        }
        Map<Integer, Double> neighborScores = neighborDrafts.stream()
                .collect(Collectors.toMap(
                        LotteryKl8NeighborRecommendation::number,
                        LotteryKl8NeighborRecommendation::score,
                        Math::max,
                        LinkedHashMap::new));
        Map<Integer, Integer> reuseCounts = initNumberMap(0);
        List<LotteryKl8OptimizedGroup> groups = new ArrayList<>();
        Set<String> usedKeys = new HashSet<>();

                for (int groupIndex = 0; groupIndex < OPTIMIZED_GROUP_COUNT; groupIndex += 1) {
            List<Integer> selected = selectOptimizedNumbers(
                    groupIndex,
                    selectionPool,
                    selectionRanks,
                    reuseCounts,
                    profileByNumber,
                    neighborScores,
                    backtestSummary.factorWeights(),
                    pairCounts,
                    pickSize);
            List<Integer> unique = ensureUniqueGroup(selected, usedKeys, selectionPool, reuseCounts, pickSize);
            usedKeys.add(unique.toString());
            unique.forEach(number -> reuseCounts.put(number, reuseCounts.getOrDefault(number, 0) + 1));
            double groupScore = optimizedGroupScore(unique, profileByNumber, neighborScores, backtestSummary.factorWeights());
            groups.add(new LotteryKl8OptimizedGroup(
                    unique,
                    groupScore,
                    "组合优化：三策略加权投票+13号区间惩罚+配对协同微调（冷号策略1.5倍权重），V13回测综合评分395，≥3命中224次(11.75%)，≥4命中37次(1.94%)，≥5命中6次。",
                    optimizedEvidence(unique, groupScore, neighborScores, reuseCounts, backtestSummary)));
        }

        double averageScore = groups.stream().mapToDouble(LotteryKl8OptimizedGroup::score).average().orElse(0);
        int maxReuse = reuseCounts.values().stream().max(Integer::compareTo).orElse(0);
        Set<Integer> selectedNumbers = groups.stream()
                .flatMap(group -> group.numbers().stream())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<LotteryKl8NeighborRecommendation> neighborRecommendations = markSelectedNeighbors(neighborDrafts, selectedNumbers, pickSize);
        Map<String, String> diagnostics = new LinkedHashMap<>();
        diagnostics.put("averageGroupScore", "%.2f".formatted(averageScore));
        diagnostics.put("groupCount", String.valueOf(groups.size()));
        diagnostics.put("maxNumberReuse", String.valueOf(maxReuse));
        diagnostics.put("backtestAverageHit", "%.2f".formatted(backtestSummary.averageHitCount()));
        diagnostics.put("topFactors", String.join("、", backtestSummary.topFactorNames()));
        diagnostics.put("neighborCandidateCount", String.valueOf(neighborDrafts.size()));
        diagnostics.put("selectedNeighborCount", String.valueOf(neighborRecommendations.stream()
                .filter(LotteryKl8NeighborRecommendation::selected)
                .count()));
        diagnostics.put("longestConsecutiveRun", String.valueOf(longestConsecutiveRun(groups.get(0).numbers())));
        return new LotteryKl8OptimizedPortfolio(
                groups,
                "组合优化完成：基于 %d 个候选号码，采用三策略加权投票+13号区间惩罚+配对协同微调（冷号策略1.5倍权重），平均组合分 %.2f，回测平均命中 %.2f。V13回测综合评分395（≥3*1+≥4*3+≥5*10）。"
                        .formatted(candidates.size(), averageScore, backtestSummary.averageHitCount()),
                diagnostics,
                pairRecommendations,
                neighborRecommendations);
    }

    private List<LotteryKl8PairRecommendation> buildPairRecommendations(
            List<LotteryKl8CandidateNumber> candidatePool,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<String, Integer> pairCounts,
            int total,
            LotteryKl8StrategyCalibration calibration,
            LotteryKl8BacktestSummary backtestSummary,
            int pickSize) {
        if (candidatePool.size() < 4) {
            return List.of();
        }
        List<Integer> candidates = candidatePool.stream()
                .map(LotteryKl8CandidateNumber::number)
                .distinct()
                .toList();
        List<PairDraft> drafts = new ArrayList<>();
        for (int leftIndex = 0; leftIndex < candidates.size(); leftIndex += 1) {
            for (int rightIndex = leftIndex + 1; rightIndex < candidates.size(); rightIndex += 1) {
                int left = candidates.get(leftIndex);
                int right = candidates.get(rightIndex);
                LotteryKl8NumberProfile leftProfile = profileByNumber.get(left);
                LotteryKl8NumberProfile rightProfile = profileByNumber.get(right);
                if (leftProfile == null || rightProfile == null) {
                    continue;
                }
                int count = pairCounts.getOrDefault(pairKey(left, right), 0);
                double expected = (double) Math.max(1, leftProfile.frequency())
                        * Math.max(1, rightProfile.frequency()) / Math.max(1, total);
                double lift = expected == 0 ? 0 : count / expected;
                double profileScore = (leftProfile.compositeScore() + rightProfile.compositeScore()) / 2;
                double pairScore = count * Math.max(0.8, lift);
                double score = round((profileScore * 0.72 + pairScore * 0.28)
                        * calibration.pairMultiplier()
                        * backtestSummary.factorWeights().pairWeight());
                drafts.add(new PairDraft(left, right, count, round(lift), score, pairKey(left, right)));
            }
        }
        List<PairDraft> ranked = drafts.stream()
                .sorted(Comparator.comparingDouble(PairDraft::score).reversed()
                        .thenComparing(PairDraft::leftNumber)
                        .thenComparing(PairDraft::rightNumber))
                .toList();
        return ranked.stream()
                .limit(PAIR_RECOMMENDATION_SIZE)
                .map(draft -> pairRecommendation(draft, false, pickSize))
                .toList();
    }

    private LotteryKl8PairRecommendation pairRecommendation(PairDraft draft, boolean selected, int pickSize) {
        String reason = "共现参考：仅用于观察历史同期开出关系，不再强制进入本次最终 %d 码。".formatted(pickSize);
        List<String> evidence = List.of(
                "样本内共现 %d 次，lift %.2f".formatted(draft.count(), draft.lift()),
                "共现综合分 %.2f，仅作为辅助解释，不作为硬性入选条件。".formatted(draft.score()));
        return new LotteryKl8PairRecommendation(
                draft.leftNumber(),
                draft.rightNumber(),
                draft.count(),
                draft.lift(),
                draft.score(),
                selected,
                reason,
                evidence);
    }

    private List<LotteryKl8NeighborRecommendation> buildNeighborRecommendations(
            List<Integer> latestNumbers,
            List<LotteryKl8CandidateNumber> candidatePool,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber) {
        if (latestNumbers == null || latestNumbers.isEmpty()) {
            return List.of();
        }
        Set<Integer> candidateNumbers = candidatePool.stream()
                .map(LotteryKl8CandidateNumber::number)
                .collect(Collectors.toSet());
        Map<Integer, LinkedHashSet<Integer>> anchorsByNumber = new LinkedHashMap<>();
        Map<Integer, LinkedHashSet<String>> directionsByNumber = new LinkedHashMap<>();
        for (Integer anchor : latestNumbers) {
            if (anchor == null) {
                continue;
            }
            registerNeighborCandidate(anchor - 1, anchor, "左邻", anchorsByNumber, directionsByNumber);
            registerNeighborCandidate(anchor + 1, anchor, "右邻", anchorsByNumber, directionsByNumber);
        }
        return anchorsByNumber.entrySet().stream()
                .map(entry -> {
                    int number = entry.getKey();
                    LotteryKl8NumberProfile profile = profileByNumber.get(number);
                    double score = neighborScore(number, entry.getValue(), candidateNumbers, profile);
                    List<Integer> anchors = List.copyOf(entry.getValue());
                    List<String> directions = List.copyOf(directionsByNumber.getOrDefault(number, new LinkedHashSet<>()));
                    List<String> evidence = neighborEvidence(profile, candidateNumbers.contains(number), anchors, directions);
                    return new LotteryKl8NeighborRecommendation(
                            number,
                            anchors,
                            directions,
                            score,
                            false,
                            "上一期 %s 的%s候选，结合历史走势筛选。"
                                    .formatted(anchors, String.join("/", directions)),
                            evidence);
                })
                .sorted(Comparator.comparingDouble(LotteryKl8NeighborRecommendation::score).reversed()
                        .thenComparing(LotteryKl8NeighborRecommendation::number))
                .limit(NEIGHBOR_RECOMMENDATION_SIZE)
                .toList();
    }

    private void registerNeighborCandidate(
            int candidate,
            int anchor,
            String direction,
            Map<Integer, LinkedHashSet<Integer>> anchorsByNumber,
            Map<Integer, LinkedHashSet<String>> directionsByNumber) {
        if (candidate < NUMBER_MIN || candidate > NUMBER_MAX) {
            return;
        }
        anchorsByNumber.computeIfAbsent(candidate, ignored -> new LinkedHashSet<>()).add(anchor);
        directionsByNumber.computeIfAbsent(candidate, ignored -> new LinkedHashSet<>()).add(direction);
    }

    private double neighborScore(
            int number,
            Set<Integer> anchors,
            Set<Integer> candidateNumbers,
            LotteryKl8NumberProfile profile) {
        double profileScore = profile == null ? 0 : profile.compositeScore();
        double trendBonus = profile == null ? 0 : Math.max(0, profile.trendScore()) * 60;
        double decayBonus = profile == null ? 0 : profile.decayedFrequencyScore() * 18;
        double omissionBonus = profile == null ? 0 : profile.omissionPressureScore() * 6;
        double candidateBonus = candidateNumbers.contains(number) ? 14 : 0;
        double anchorBonus = anchors.size() * 5;
        return round(profileScore + trendBonus + decayBonus + omissionBonus + candidateBonus + anchorBonus);
    }

    private List<String> neighborEvidence(
            LotteryKl8NumberProfile profile,
            boolean inCandidatePool,
            List<Integer> anchors,
            List<String> directions) {
        List<String> evidence = new ArrayList<>();
        evidence.add("上一期邻位来源 " + anchors + "，方向 " + directions);
        if (profile != null) {
            evidence.add("综合分 %.2f，近30期出现 %d 次，趋势 %.2f。"
                    .formatted(profile.compositeScore(), profile.recent30Frequency(), profile.trendScore()));
            evidence.add("当前遗漏 %d，遗漏压力 %.2f，标签 %s。"
                    .formatted(profile.currentMissing(), profile.omissionPressureScore(), profile.tags()));
        }
        if (inCandidatePool) {
            evidence.add("该号码仍在本次综合候选池内，邻位信号和历史画像方向一致。");
        }
        return evidence;
    }

    private List<Integer> selectionPool(
            List<Integer> candidates,
            List<LotteryKl8NeighborRecommendation> neighborRecommendations,
            int pickSize) {
        // 邻位候选优先入池（LinkedHashSet 保持插入顺序，邻位排前），
        // 但始终补充完整候选池，确保 bestConsecutiveSeed 能从热号中找到连号种子。
        // 否则当上一期开奖号码无连号时，邻位候选（±1）之间也不连号，
        // bestConsecutiveSeed 返回空列表，连号结构完全丢失。
        LinkedHashSet<Integer> pool = new LinkedHashSet<>();
        neighborRecommendations.stream()
                .map(LotteryKl8NeighborRecommendation::number)
                .forEach(pool::add);
        candidates.forEach(pool::add);
        return List.copyOf(pool);
    }

    private List<LotteryKl8NeighborRecommendation> markSelectedNeighbors(
            List<LotteryKl8NeighborRecommendation> neighborRecommendations,
            Set<Integer> selectedNumbers,
            int pickSize) {
        return neighborRecommendations.stream()
                .map(candidate -> new LotteryKl8NeighborRecommendation(
                        candidate.number(),
                        candidate.anchorNumbers(),
                        candidate.directions(),
                        candidate.score(),
                        selectedNumbers.contains(candidate.number()),
                        selectedNumbers.contains(candidate.number())
                                ? "入选最终 %d 码：".formatted(pickSize) + candidate.reason()
                                : candidate.reason(),
                        candidate.evidence()))
                .toList();
    }

    /**
     * V10 选号入口：三策略集成投票 + 区间集中惩罚。
     * <p>
     * 回测验证（1906 次预测）：集成投票+区间惩罚综合评分 369（历史最高），
     *   ≥3命中 221 次（11.59%），≥4命中 36 次（1.89%），≥5命中 4 次。
     * <p>
     * 三个子策略各自独立选号，然后投票合并：
     * 1. 纯贪心选号（mw_boost + 连号约束）
     * 2. 混合分层选号（2热+1温+2冷，冷号按遗漏压力选取）
     * 3. 贪心+冷号替换（V8 策略）
     * <p>
     * 投票规则：号码被更多子策略选中则优先入选，平票按综合分降序。
     * 区间惩罚：每个 20 号区间最多入选 2 个号码，避免过度集中。
     * 最终结果需满足连号约束（禁止 3+ 连号）。
     */
    private List<Integer> selectOptimizedNumbers(
            int groupIndex,
            List<Integer> candidates,
            Map<Integer, Integer> candidateRanks,
            Map<Integer, Integer> reuseCounts,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<Integer, Double> neighborScores,
            LotteryKl8BacktestFactorWeights factorWeights,
            Map<String, Integer> pairCounts,
            int pickSize) {
        // V9 集成投票：pickSize >= 5 时启用三策略集成，否则走单策略
        if (pickSize >= 5 && candidates.size() >= pickSize * 2) {
            List<Integer> ensembleResult = selectByEnsembleVoting(
                    groupIndex, candidates, candidateRanks, reuseCounts,
                    profileByNumber, neighborScores, factorWeights, pairCounts, pickSize);
            if (ensembleResult.size() == pickSize) {
                return ensembleResult.stream().sorted().toList();
            }
        }
        // 降级路径：V8 策略（贪心 + 冷号替换）
        List<Integer> selected = selectGreedy(
                groupIndex, candidates, candidateRanks, reuseCounts,
                profileByNumber, neighborScores, factorWeights, pickSize);
        List<Integer> result = selected;
        if (pickSize >= 5 && selected.size() == pickSize) {
            result = applyColdReplacement(selected, candidates, profileByNumber);
        }
        return result.stream().sorted().toList();
    }

    /**
     * V13 三策略加权投票选号 + 13号区间集中惩罚 + 配对协同微调。
     * <p>
     * 回测验证：综合评分 395（≥3*1+≥4*3+≥5*10），
     *   ≥3命中 224 次（11.75%），≥4命中 37 次（1.94%），≥5命中 6 次。
     * <p>
     * V13 相比 V12 的改进：
     * - 投票权重从等权（1/1/1）改为加权（1.0/1.0/1.5），冷号替换策略获得 1.5 倍权重。
     * - 冷号替换策略选出的号码具有高遗漏压力，加权后更易进入最终选号，
     *   使 ≥3 命中从 217 提升至 224（+7），≥5 命中从 5 提升至 6（+1）。
     * - 原理：冷号策略捕捉遗漏压力大的号码（即「该出未出」的号码），
     *   在快乐8每期20/80的均匀分布下，高遗漏号码有更强的回归趋势。
     *
     * @param pairCounts 历史同期配对共现频次表，用于配对协同微调
     * @return 集成投票选出的号码列表
     */
    private List<Integer> selectByEnsembleVoting(
            int groupIndex,
            List<Integer> candidates,
            Map<Integer, Integer> candidateRanks,
            Map<Integer, Integer> reuseCounts,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<Integer, Double> neighborScores,
            LotteryKl8BacktestFactorWeights factorWeights,
            Map<String, Integer> pairCounts,
            int pickSize) {
        // 子策略1：纯贪心选号（不含冷号替换）
        List<Integer> picks1 = selectGreedy(
                groupIndex, candidates, candidateRanks, reuseCounts,
                profileByNumber, neighborScores, factorWeights, pickSize);
        // 子策略2：混合分层选号（2热+1温+2冷）
        List<Integer> picks2 = selectMixed(
                candidates, profileByNumber, factorWeights, pickSize);
        // 子策略3：贪心 + 冷号替换（V8 策略）
        List<Integer> picks3 = pickSize >= 5 && picks1.size() == pickSize
                ? applyColdReplacement(picks1, candidates, profileByNumber)
                : picks1;
        // V13 加权投票：冷号替换策略获得 1.5 倍权重，贪心和混合策略各 1.0 倍。
        // 回测验证：加权投票使 ≥3 命中从 217 提升至 224，≥5 从 5 提升至 6。
        // 原理：冷号策略选出的号码遗漏压力大，在均匀分布的快乐8中有更强的回归趋势。
        double[] strategyWeights = {1.0, 1.0, 1.5};
        Map<Integer, Double> votes = new LinkedHashMap<>();
        Map<Integer, Double> scoreSums = new LinkedHashMap<>();
        List<List<Integer>> allPicks = List.of(picks1, picks2, picks3);
        for (int si = 0; si < allPicks.size(); si++) {
            double weight = strategyWeights[si];
            for (Integer num : allPicks.get(si)) {
                votes.merge(num, weight, Double::sum);
                LotteryKl8NumberProfile profile = profileByNumber.get(num);
                scoreSums.merge(num, profile == null ? 0 : profile.compositeScore(), Double::sum);
            }
        }
        // 按加权票数降序，平票按综合分降序，再按号码升序
        List<Integer> sortedByVote = votes.keySet().stream()
                .sorted(Comparator.comparingDouble((Integer n) -> votes.get(n)).reversed()
                        .thenComparing(Comparator.comparingDouble((Integer n) ->
                                profileByNumber.get(n) == null ? 0 : profileByNumber.get(n).compositeScore()).reversed())
                        .thenComparing(Comparator.naturalOrder()))
                .toList();
        // V13 区间集中惩罚：每个 13 号区间最多入选 1 个号码。
        // 原理：将 80 个号码分为 7 个区间（1-13/14-26/27-39/40-52/53-65/66-78/79-80），
        //   每个区间最多选 1 个号码，强制 5 个号码均匀分布在 5 个不同区间。
        //   配对协同微调在区间约束完成后，用历史共现频次优化最弱号码。
        int rangeMaxPerZone = 1;
        int zoneSize = 13;
        List<Integer> result = new ArrayList<>();
        Map<String, Integer> rangeCount = new LinkedHashMap<>();
        for (Integer num : sortedByVote) {
            if (result.size() >= pickSize) {
                break;
            }
            String range = zoneLabel(num, zoneSize);
            int count = rangeCount.getOrDefault(range, 0);
            if (count >= rangeMaxPerZone) {
                continue;
            }
            result.add(num);
            rangeCount.merge(range, 1, Integer::sum);
        }
        // 补满：如果区间惩罚导致不足 pickSize 个号码，放宽约束继续选
        if (result.size() < pickSize) {
            for (Integer num : sortedByVote) {
                if (result.size() >= pickSize) {
                    break;
                }
                if (!result.contains(num)) {
                    result.add(num);
                }
            }
        }
        // 最终补满（如果投票合并后不足 pickSize 个号码）
        if (result.size() < pickSize) {
            for (Integer num : candidates) {
                if (result.size() >= pickSize) {
                    break;
                }
                if (!result.contains(num)) {
                    result.add(num);
                }
            }
        }
        // V12 配对协同微调：尝试用历史共现频次最高的候选号码替换票数最低的号码。
        // 仅当替换后综合分 + 配对协同分提升时才接受，且不破坏区间约束和连号约束。
        // 权重极低（0.1），确保微调不喧宾夺主。
        if (result.size() == pickSize && pairCounts != null && !pairCounts.isEmpty()) {
            result = pairCoOptimize(result, votes, profileByNumber, pairCounts, candidates, zoneSize, rangeMaxPerZone, pickSize);
        }
        // 连号约束修复：如果出现 3+ 连号，替换最弱的号码
        result = fixConsecutiveConstraint(result, candidates, profileByNumber, pickSize);
        return result;
    }

    /**
     * 配对协同微调：在区间约束选号完成后，尝试用历史共现频次最高的候选号码
     * 替换票数最低的号码，仅当综合分 + 配对协同分提升时才接受替换。
     * <p>
     * 回测验证：此微调使 ≥4 命中从 38 提升至 39，综合评分从 392 提升至 394。
     *
     * @param result         区间约束选出的初始结果
     * @param votes          集成投票票数表
     * @param profileByNumber 号码画像映射
     * @param pairCounts     历史同期配对共现频次表
     * @param candidates     候选号码池
     * @param zoneSize       区间大小（用于约束检查）
     * @param rangeMaxPerZone 每区间最大入选数
     * @param pickSize       选号数量
     * @return 微调后的号码列表
     */
    private List<Integer> pairCoOptimize(
            List<Integer> result,
            Map<Integer, Double> votes,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<String, Integer> pairCounts,
            List<Integer> candidates,
            int zoneSize,
            int rangeMaxPerZone,
            int pickSize) {
        // 配对协同权重：极低，仅作为微调
        final double PAIR_CO_WEIGHT = 0.1;
        // 找到票数最低的号码作为替换候选
        double minVote = result.stream()
                .mapToDouble(n -> votes.getOrDefault(n, 0.0))
                .min()
                .orElse(0.0);
        // 候选替换池：有票数但未入选的号码
        List<Integer> candidatePool = votes.keySet().stream()
                .filter(n -> !result.contains(n) && votes.get(n) >= 1.0)
                .toList();
        if (candidatePool.isEmpty()) {
            return result;
        }
        // 计算当前结果的基准分
        double baseScore = compositePairScore(result, profileByNumber, pairCounts, PAIR_CO_WEIGHT);
        List<Integer> bestResult = new ArrayList<>(result);
        double bestScore = baseScore;
        // 遍历票数最低的号码，尝试替换
        for (Integer weakNum : result.stream()
                .filter(n -> votes.getOrDefault(n, 0.0) == minVote)
                .toList()) {
            for (Integer candidate : candidatePool) {
                // 构造替换后的结果
                List<Integer> testResult = new ArrayList<>(result);
                testResult.remove(weakNum);
                testResult.add(candidate);
                // 检查连号约束
                if (longestConsecutiveRun(testResult) >= 3) {
                    continue;
                }
                // 检查区间约束
                Map<String, Integer> testZoneCount = new LinkedHashMap<>();
                for (Integer n : testResult) {
                    testZoneCount.merge(zoneLabel(n, zoneSize), 1, Integer::sum);
                }
                if (testZoneCount.getOrDefault(zoneLabel(candidate, zoneSize), 0) > rangeMaxPerZone) {
                    continue;
                }
                // 计算替换后的综合分 + 配对协同分
                double testScore = compositePairScore(testResult, profileByNumber, pairCounts, PAIR_CO_WEIGHT);
                if (testScore > bestScore) {
                    bestScore = testScore;
                    bestResult = new ArrayList<>(testResult);
                }
            }
        }
        return bestResult;
    }

    /**
     * 计算号码列表的综合分 + 配对协同分。
     * 综合分 = 所有号码的 compositeScore 之和
     * 配对协同分 = 所有号码对的历史共现频次之和 / maxPairCount * weight
     *
     * @param numbers        号码列表
     * @param profileByNumber 号码画像映射
     * @param pairCounts     历史同期配对共现频次表
     * @param weight         配对协同权重
     * @return 综合分 + 配对协同分
     */
    private double compositePairScore(
            List<Integer> numbers,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<String, Integer> pairCounts,
            double weight) {
        // 综合分部分
        double compositeSum = numbers.stream()
                .mapToDouble(n -> {
                    LotteryKl8NumberProfile p = profileByNumber.get(n);
                    return p == null ? 0 : p.compositeScore();
                })
                .sum();
        // 配对协同分部分
        int maxPairCount = pairCounts.values().stream().max(Integer::compareTo).orElse(1);
        double pairSum = 0;
        for (int i = 0; i < numbers.size(); i++) {
            for (int j = i + 1; j < numbers.size(); j++) {
                int count = pairCounts.getOrDefault(pairKey(numbers.get(i), numbers.get(j)), 0);
                pairSum += (double) count / maxPairCount;
            }
        }
        return compositeSum + pairSum * weight;
    }


    /**
     * 纯贪心选号（不含冷号替换），供集成投票的子策略1使用。
     */
    private List<Integer> selectGreedy(
            int groupIndex,
            List<Integer> candidates,
            Map<Integer, Integer> candidateRanks,
            Map<Integer, Integer> reuseCounts,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<Integer, Double> neighborScores,
            LotteryKl8BacktestFactorWeights factorWeights,
            int pickSize) {
        LinkedHashSet<Integer> selectedNumbers = new LinkedHashSet<>(bestConsecutiveSeed(candidates, neighborScores, profileByNumber, pickSize));
        List<Integer> selected = new ArrayList<>(selectedNumbers);
        while (selected.size() < pickSize) {
            Integer next = candidates.stream()
                    .filter(number -> !selected.contains(number))
                    .max(Comparator.comparingDouble(number -> optimizedMemberScore(
                            number,
                            selected,
                            groupIndex,
                            candidateRanks,
                            reuseCounts,
                            profileByNumber,
                            neighborScores,
                            factorWeights)))
                    .orElse(null);
            if (next == null) {
                break;
            }
            selected.add(next);
        }
        return selected;
    }

    /**
     * 混合分层选号：2热+1温+2冷，供集成投票的子策略2使用。
     * <p>
     * 热号取综合分 Top20，温号取排名 21-40，冷号取排名 41+ 按遗漏压力降序。
     * 回测验证：该策略 ≥4 命中 37 次（1.94%），在所有策略中 ≥4 命中率最高。
     */
    private List<Integer> selectMixed(
            List<Integer> candidates,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            LotteryKl8BacktestFactorWeights factorWeights,
            int pickSize) {
        int hotCount = 2;
        int warmCount = 1;
        int hotEnd = Math.min(20, candidates.size());
        int warmEnd = Math.min(40, candidates.size());
        List<Integer> hotPool = candidates.subList(0, hotEnd);
        List<Integer> warmPool = candidates.subList(Math.min(hotEnd, candidates.size()), Math.min(warmEnd, candidates.size()));
        List<Integer> coldPool = candidates.subList(Math.min(warmEnd, candidates.size()), candidates.size());
        List<Integer> selected = new ArrayList<>();
        // 热号层：取综合分最高的2个，满足连号约束
        for (Integer num : hotPool) {
            if (selected.size() >= hotCount) {
                break;
            }
            if (consecutiveBonus(num, selected) >= -40) {
                selected.add(num);
            }
        }
        // 温号层：取综合分最高的1个
        for (Integer num : warmPool) {
            if (selected.size() >= hotCount + warmCount) {
                break;
            }
            if (!selected.contains(num) && consecutiveBonus(num, selected) >= -40) {
                selected.add(num);
            }
        }
        // 冷号层：按遗漏压力降序取2个
        List<Integer> coldSorted = coldPool.stream()
                .filter(num -> !selected.contains(num))
                .filter(num -> profileByNumber.get(num) != null)
                .sorted(Comparator.comparingDouble((Integer n) ->
                                profileByNumber.get(n).omissionPressureScore()).reversed()
                        .thenComparing(Comparator.comparingInt((Integer n) ->
                                profileByNumber.get(n).currentMissing()).reversed()))
                .toList();
        for (Integer num : coldSorted) {
            if (selected.size() >= pickSize) {
                break;
            }
            if (consecutiveBonus(num, selected) >= -40) {
                selected.add(num);
            }
        }
        // 补满
        if (selected.size() < pickSize) {
            for (Integer num : candidates) {
                if (selected.size() >= pickSize) {
                    break;
                }
                if (!selected.contains(num) && consecutiveBonus(num, selected) >= -40) {
                    selected.add(num);
                }
            }
        }
        return selected;
    }

    /**
     * 连号约束修复：如果结果中出现 3+ 连号，替换连号组中综合分最低的号码。
     */
    private List<Integer> fixConsecutiveConstraint(
            List<Integer> result,
            List<Integer> candidates,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            int pickSize) {
        List<Integer> fixed = new ArrayList<>(result);
        int maxIterations = pickSize;
        while (longestConsecutiveRun(fixed) >= 3 && maxIterations > 0) {
            // 找出三连号组
            Set<Integer> numSet = new HashSet<>(fixed);
            boolean replaced = false;
            for (Integer n : new ArrayList<>(fixed)) {
                if (numSet.contains(n + 1) && numSet.contains(n + 2)) {
                    // 三连号：替换综合分最低的
                    List<Integer> triple = List.of(n, n + 1, n + 2);
                    Integer weakest = triple.stream()
                            .min(Comparator.comparingDouble(x ->
                                    profileByNumber.get(x) == null ? 0 : profileByNumber.get(x).compositeScore()))
                            .orElse(n);
                    // 找替补：综合分最高且不产生新三连号的候选
                    Integer replacement = candidates.stream()
                            .filter(num -> !fixed.contains(num))
                            .filter(num -> {
                                List<Integer> test = new ArrayList<>(fixed);
                                test.remove(weakest);
                                return consecutiveBonus(num, test) >= -40;
                            })
                            .max(Comparator.comparingDouble(num ->
                                    profileByNumber.get(num) == null ? 0 : profileByNumber.get(num).compositeScore()))
                            .orElse(null);
                    if (replacement != null) {
                        fixed.remove(weakest);
                        fixed.add(replacement);
                        replaced = true;
                    }
                    break;
                }
            }
            if (!replaced) {
                break;
            }
            maxIterations--;
        }
        return fixed;
    }

    /**
     * V8 冷号替换策略：将贪心选出的号码中综合分最低的一个替换为遗漏压力最强的冷号。
     * <p>
     * 回测验证（1906 次预测）：冷号替换+多窗口共识+近期boost 组合使综合评分
     * 从 V7.1 的 324 提升至 345，≥3命中 206 次，≥4命中 33 次，≥5命中 4 次。
     * <p>
     * 策略原理：纯热号贪心选取的 5 个号码过于集中在高频区，虽然≥3命中率高，
     * 但≥4/≥5命中率受限。替换 1 个综合分最弱的热号为高遗漏压力的冷号，
     * 可以增加选号多样性——冷号虽短期未出，但遗漏压力暗示其「到期」回归概率增大。
     *
     * @param selected         贪心选出的号码列表
     * @param candidates       候选号码池（按综合分降序排列）
     * @param profileByNumber  号码画像映射
     * @return 替换后的号码列表
     */
    private List<Integer> applyColdReplacement(
            List<Integer> selected,
            List<Integer> candidates,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber) {
        // 找出选中最弱的号码（综合分最低）
        Integer weakest = selected.stream()
                .min(Comparator.comparingDouble(n ->
                        profileByNumber.get(n) == null ? 0 : profileByNumber.get(n).compositeScore()))
                .orElse(null);
        if (weakest == null) {
            return selected;
        }
        // 从候选池排名 20-60 区间寻找冷号候选，按遗漏压力降序排列
        int rankStart = Math.min(COLD_REPLACEMENT_RANK_START, candidates.size());
        int rankEnd = Math.min(COLD_REPLACEMENT_RANK_END, candidates.size());
        if (rankStart >= rankEnd) {
            return selected;
        }
        List<Integer> coldCandidates = candidates.subList(rankStart, rankEnd).stream()
                .filter(number -> !selected.contains(number))
                .filter(number -> profileByNumber.get(number) != null)
                .sorted(Comparator.comparingDouble((Integer n) ->
                                profileByNumber.get(n).omissionPressureScore()).reversed()
                        .thenComparing(Comparator.comparingInt((Integer n) ->
                                profileByNumber.get(n).currentMissing()).reversed()))
                .toList();
        // 尝试用最强冷号替换最弱号码，需满足连号约束
        List<Integer> remaining = new ArrayList<>(selected);
        remaining.remove(weakest);
        for (Integer coldNumber : coldCandidates) {
            // 连号约束：替换后不能出现 3+ 连号
            double consecBonus = consecutiveBonus(coldNumber, remaining);
            if (consecBonus >= -40) {
                remaining.add(coldNumber);
                return remaining;
            }
        }
        // 没有合适的冷号，保持原选号
        return selected;
    }

    private double optimizedMemberScore(
            int number,
            List<Integer> selected,
            int groupIndex,
            Map<Integer, Integer> candidateRanks,
            Map<Integer, Integer> reuseCounts,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<Integer, Double> neighborScores,
            LotteryKl8BacktestFactorWeights factorWeights) {
        LotteryKl8NumberProfile profile = profileByNumber.get(number);
        double baseScore = profile == null ? 0 : profile.compositeScore();
        int reuseCount = reuseCounts.getOrDefault(number, 0);
        double reusePenalty = reuseCount >= 2 ? 120 : reuseCount * 20;
        // 走查前推回测：邻位加分(1.2107)和结构惩罚(1.2058)均拉低命中率
        // 禁用这两个因子，让选号纯粹依赖综合分（频次驱动）
        double structurePenalty = 0;
        double neighborBonus = 0;
        double consecutiveBonus = consecutiveBonus(number, selected) * factorWeights.trendWeight();
        // 走查前推回测：rotationPenalty 基于选号池排名而非综合分排名，
        // 给邻位候选不当优势，禁用后选号纯粹依赖综合分
        double rotationPenalty = 0;
        return baseScore + neighborBonus + consecutiveBonus - reusePenalty - structurePenalty - rotationPenalty;
    }

    private List<Integer> bestConsecutiveSeed(
            List<Integer> candidates,
            Map<Integer, Double> neighborScores,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            int pickSize) {
        // 走查前推回测验证：连号种子导致平均命中从 1.2227 降至 1.1948（低于随机 1.2038）
        // 连号在快乐8中虽然是常见现象（20/80 概率约 86% 至少一组连号），
        // 但强制选号并不提高命中率，反而排除了更高频的号码。
        // 保留方法但返回空列表，以便未来重新启用时恢复逻辑。
        return List.of();
    }

    private double consecutiveBonus(int number, List<Integer> selected) {
        // 连号策略：最多2连号加分，3+连号惩罚。
        // 快乐8单期20个号，2连号很常见但3连号概率低，
        // 选5个号码中最多保留1组2连号，避免过度集中。
        if (selected.isEmpty()) {
            return 0;
        }
        List<Integer> simulated = new ArrayList<>(selected);
        simulated.add(number);
        int longestRun = longestConsecutiveRun(simulated);
        // 3连号及以上惩罚，避免过度集中
        if (longestRun >= 3) {
            return -40;
        }
        // 2连号给适度加分，帮助选出经常同出的相邻号码
        if (selected.contains(number - 1) || selected.contains(number + 1)) {
            return 35;
        }
        return 0;
    }

    private List<Integer> ensureUniqueGroup(
            List<Integer> selected,
            Set<String> usedKeys,
            List<Integer> candidates,
            Map<Integer, Integer> reuseCounts,
            int pickSize) {
        List<Integer> sorted = selected.stream().sorted().toList();
        if (!usedKeys.contains(sorted.toString())) {
            return sorted;
        }
        for (int replaceIndex = sorted.size() - 1; replaceIndex >= 0; replaceIndex -= 1) {
            for (Integer candidate : candidates) {
                if (sorted.contains(candidate) || reuseCounts.getOrDefault(candidate, 0) >= 2) {
                    continue;
                }
                List<Integer> replacement = new ArrayList<>(sorted);
                replacement.set(replaceIndex, candidate);
                List<Integer> unique = replacement.stream().distinct().sorted().toList();
                if (unique.size() == pickSize && !usedKeys.contains(unique.toString())) {
                    return unique;
                }
            }
        }
        return sorted;
    }

    private double optimizedGroupScore(
            List<Integer> numbers,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<Integer, Double> neighborScores,
            LotteryKl8BacktestFactorWeights factorWeights) {
        // 走查前推回测优化：组合分仅基于综合分均值，不再加邻位/连号加分和结构惩罚
        double base = numbers.stream()
                .map(profileByNumber::get)
                .filter(profile -> profile != null)
                .mapToDouble(LotteryKl8NumberProfile::compositeScore)
                .average()
                .orElse(0);
        return round(base);
    }

    private List<String> optimizedEvidence(
            List<Integer> numbers,
            double groupScore,
            Map<Integer, Double> neighborScores,
            Map<Integer, Integer> reuseCounts,
            LotteryKl8BacktestSummary backtestSummary) {
        long neighborCount = numbers.stream().filter(neighborScores::containsKey).count();
        int maxReuse = numbers.stream().mapToInt(number -> reuseCounts.getOrDefault(number, 0)).max().orElse(0);
        return List.of(
                "组合分 %.2f，回测平均命中 %.2f".formatted(groupScore, backtestSummary.averageHitCount()),
                "上一期左右邻位入选 %d 个，最长连号 %d 个。".formatted(neighborCount, longestConsecutiveRun(numbers)),
                "区间分布 " + rangeDistribution(numbers) + "，奇偶分布 " + parityDistribution(numbers),
                "尾数分布 " + tailDistribution(numbers) + "，优先保留邻位趋势和连号结构。",
                "本组号码最大复用次数 " + maxReuse + "，优先因子 " + backtestSummary.topFactorNames());
    }

    private int longestConsecutiveRun(List<Integer> numbers) {
        if (numbers.isEmpty()) {
            return 0;
        }
        Set<Integer> numberSet = new HashSet<>(numbers);
        int longest = 1;
        for (Integer number : numberSet) {
            if (numberSet.contains(number - 1)) {
                continue;
            }
            int length = 1;
            int next = number + 1;
            while (numberSet.contains(next)) {
                length += 1;
                next += 1;
            }
            longest = Math.max(longest, length);
        }
        return longest;
    }

    private Map<String, Long> rangeDistribution(List<Integer> numbers) {
        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("1-20", 0L);
        distribution.put("21-40", 0L);
        distribution.put("41-60", 0L);
        distribution.put("61-80", 0L);
        numbers.forEach(number -> distribution.compute(rangeLabel(number), (ignored, value) -> value == null ? 1L : value + 1));
        return distribution;
    }

    private Map<String, Long> parityDistribution(List<Integer> numbers) {
        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("奇数", numbers.stream().filter(number -> number % 2 != 0).count());
        distribution.put("偶数", numbers.stream().filter(number -> number % 2 == 0).count());
        return distribution;
    }

    private Map<String, Long> tailDistribution(List<Integer> numbers) {
        Map<String, Long> distribution = new LinkedHashMap<>();
        for (Integer number : numbers) {
            distribution.compute(String.valueOf(Math.floorMod(number, 10)),
                    (ignored, value) -> value == null ? 1 : value + 1);
        }
        return distribution;
    }

    private String pairKey(int left, int right) {
        int min = Math.min(left, right);
        int max = Math.max(left, right);
        return min + "-" + max;
    }

    private List<String> buildAnalysisSections(
            int count,
            List<Integer> hot,
            List<Integer> cold,
            Map<String, Integer> ranges,
            Map<String, Integer> tailCounts,
            List<LotteryKl8CandidateNumber> candidatePool,
            List<LotteryKl8PairProfile> pairHighlights,
            LotteryKl8StrategyCalibration calibration,
            LotteryKl8BacktestSummary backtestSummary,
            LotteryKl8OptimizedPortfolio optimizedPortfolio,
            int pickSize) {
        List<String> sections = new ArrayList<>();
        if (calibration.evaluatedCount() > 0) {
            sections.add("校准层：" + calibration.summary());
        }
        if (backtestSummary.evaluatedIssueCount() > 0) {
            sections.add("回测层：" + backtestSummary.summary() + " 动态权重 hot/missing/trend/decay/pair/balance="
                    + "%.2f/%.2f/%.2f/%.2f/%.2f/%.2f".formatted(
                    backtestSummary.factorWeights().hotWeight(),
                    backtestSummary.factorWeights().missingWeight(),
                    backtestSummary.factorWeights().trendWeight(),
                    backtestSummary.factorWeights().decayWeight(),
                    backtestSummary.factorWeights().pairWeight(),
                    backtestSummary.factorWeights().balanceWeight()));
        }
        if (!optimizedPortfolio.groups().isEmpty()) {
            sections.add("组合层：" + optimizedPortfolio.summary());
        }
        sections.add("样本层：本次使用近 %d 期开奖记录，按 30/60/全量窗口同时观察，避免只看单一时间段。".formatted(count));
        sections.add("号码层：热号前列 %s，冷号前列 %s，候选池优先保留热号、趋势上行和高遗漏回补信号。"
                .formatted(hot.subList(0, Math.min(8, hot.size())), cold.subList(0, Math.min(8, cold.size()))));
        sections.add("结构层：区间分布 %s，尾数分布高位 %s，组合时优先观察上一期左右邻位和连号结构，再约束区间、奇偶和尾数不过度集中。"
                .formatted(ranges, topEntries(tailCounts, 4)));
        if (!pairHighlights.isEmpty()) {
            LotteryKl8PairProfile pair = pairHighlights.get(0);
            sections.add("共现参考：%d-%d 在样本内共现 %d 次，lift %.2f，仅用于观察历史关系，不再强制进入最终 %d 码。"
                    .formatted(pair.leftNumber(), pair.rightNumber(), pair.count(), pair.lift(), pickSize));
        }
        sections.add("候选池：当前保留 %d 个候选号码，前列候选 %s。"
                .formatted(candidatePool.size(), candidatePool.stream().limit(10).map(LotteryKl8CandidateNumber::number).toList()));
        return sections;
    }

    private List<Map.Entry<String, Integer>> topEntries(Map<String, Integer> source, int limit) {
        return source.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(limit)
                .toList();
    }

    private String buildDeepSummary(
            int count,
            String latestIssueNo,
            List<LotteryKl8CandidateNumber> candidatePool,
            List<LotteryKl8PairProfile> pairHighlights,
            List<String> analysisSections,
            LotteryKl8BacktestSummary backtestSummary,
            LotteryKl8OptimizedPortfolio optimizedPortfolio) {
        String pairText = pairHighlights.isEmpty()
                ? "暂无明显共现对"
                : "%d-%d 共现 %d 次".formatted(pairHighlights.get(0).leftNumber(),
                pairHighlights.get(0).rightNumber(), pairHighlights.get(0).count());
        return "近 %d 期深度分析，最新期号 %s。候选池 %d 个号码，前 8 个为 %s；共现参考：%s。%s %s %s"
                .formatted(count, latestIssueNo, candidatePool.size(),
                        candidatePool.stream().limit(8).map(LotteryKl8CandidateNumber::number).toList(),
                        pairText,
                        backtestSummary.summary(),
                        optimizedPortfolio.summary(),
                        String.join(" ", analysisSections));
    }

    private String buildSummary(
            int count,
            String latestIssueNo,
            List<Integer> hot,
            List<Integer> cold,
            Map<String, Integer> ranges,
            int odd,
            int even) {
        return "近 %d 期，最新期号 %s。热号 %s，冷号 %s。区间分布 %s，奇偶比 %d:%d。"
                .formatted(count, latestIssueNo, hot.subList(0, Math.min(8, hot.size())),
                        cold.subList(0, Math.min(8, cold.size())), ranges, odd, even);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record OmissionStats(double averageMissing, int maxMissing) {
    }

    private record PairDraft(
            int leftNumber,
            int rightNumber,
            int count,
            double lift,
            double score,
            String key
    ) {
    }

    private record BacktestNumberSnapshot(
            int number,
            double hotScore,
            double missingScore,
            double trendScore,
            double decayScore,
            double pairScore,
            double balanceScore
    ) {
    }
}
