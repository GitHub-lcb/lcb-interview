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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * 快乐8历史特征服务，为 AI 推荐提供结构化统计输入。
 */
@Service
@RequiredArgsConstructor
public class LotteryKl8FeatureService {

    private static final int NUMBER_MIN = 1;
    private static final int NUMBER_MAX = 80;
    private static final int MAX_BASE_ISSUE_COUNT = 2000;
    private static final int CANDIDATE_POOL_SIZE = 32;
    private static final int PAIR_HIGHLIGHT_SIZE = 20;
    private static final List<String> BACKTEST_FACTORS = List.of(
            "hot", "missing", "trend", "decay", "pair", "balance");

    private final LotteryKl8DrawMapper drawMapper;

    /**
     * 基于最近指定期数构建快乐8特征报告。
     *
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(int baseIssueCount) {
        return buildReport(baseIssueCount, LotteryKl8StrategyCalibration.neutral());
    }

    /**
     * 基于最近指定期数和历史命中反馈校准参数构建快乐8特征报告。
     *
     * @param baseIssueCount 使用历史期数
     * @param calibration    策略校准参数，空值时使用中性参数
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(int baseIssueCount, LotteryKl8StrategyCalibration calibration) {
        LotteryKl8StrategyCalibration calibrationToUse = calibration == null
                ? LotteryKl8StrategyCalibration.neutral()
                : calibration;
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
        LotteryKl8BacktestSummary backtestSummary = buildBacktestSummary(drawSets);
        List<LotteryKl8NumberProfile> profiles = buildNumberProfiles(
                drawSets,
                frequency,
                missing,
                hot,
                cold,
                calibrationToUse,
                backtestSummary.factorWeights());
        List<LotteryKl8CandidateNumber> candidatePool = buildCandidatePool(profiles);
        List<LotteryKl8PairProfile> pairHighlights = buildPairHighlights(drawSets, frequency);
        LotteryKl8OptimizedPortfolio optimizedPortfolio = buildOptimizedPortfolio(
                candidatePool, profiles, pairHighlights, backtestSummary);
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
                optimizedPortfolio);
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

    private LotteryKl8BacktestSummary buildBacktestSummary(List<Set<Integer>> drawSets) {
        if (drawSets.size() < 35) {
            return LotteryKl8BacktestSummary.empty();
        }

        List<Set<Integer>> chronological = new ArrayList<>(drawSets);
        Collections.reverse(chronological);
        Map<Integer, Integer> hitDistribution = initHitDistribution();
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
            int combinedHit = hitCount(topNumbers(snapshots, this::backtestCombinedScore, 5), target);
            hitDistribution.compute(combinedHit, (ignored, value) -> value == null ? 1 : value + 1);
            combinedHitTotal += combinedHit;
            maxHit = Math.max(maxHit, combinedHit);
            evaluated += 1;
            factorHitTotals.compute("hot", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::hotScore, 5), target));
            factorHitTotals.compute("missing", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::missingScore, 5), target));
            factorHitTotals.compute("trend", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::trendScore, 5), target));
            factorHitTotals.compute("decay", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::decayScore, 5), target));
            factorHitTotals.compute("pair", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::pairScore, 5), target));
            factorHitTotals.compute("balance", (ignored, value) ->
                    value + hitCount(topNumbers(snapshots, BacktestNumberSnapshot::balanceScore, 5), target));
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
                "滚动回测 %d 期，模拟 5 码平均命中 %.2f 个，最高命中 %d 个；近期表现靠前因子：%s。"
                        .formatted(evaluated, averageHit, maxHit, topFactorNames));
    }

    private Map<Integer, Integer> initHitDistribution() {
        Map<Integer, Integer> distribution = new LinkedHashMap<>();
        for (int hit = 0; hit <= 5; hit += 1) {
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
            double weight = Math.pow(0.985, age);
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
            LotteryKl8BacktestFactorWeights backtestWeights) {
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
            double compositeScore = round((frequencyScore * 20 + recentScore * 16 + midTermScore * 8)
                    * calibration.hotMultiplier() * backtestWeights.hotWeight()
                    + decayedFrequencyScore * 18 * calibration.hotMultiplier() * backtestWeights.decayWeight()
                    + Math.max(missingScore, Math.min(1, omissionPressureScore / 2))
                    * 18 * calibration.missingMultiplier() * backtestWeights.missingWeight()
                    + Math.min(1, trendPositive) * 12 * calibration.trendMultiplier() * backtestWeights.trendWeight()
                    + stabilityScore * 8 * calibration.balanceMultiplier() * backtestWeights.balanceWeight()
                    + coldRecoveryScore * 8 * (calibration.coldMultiplier() - 1));
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
            double weight = Math.pow(0.985, index);
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

    private List<LotteryKl8PairProfile> buildPairHighlights(
            List<Set<Integer>> drawSets,
            Map<Integer, Integer> frequency) {
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
        int total = drawSets.size();
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
            List<LotteryKl8PairProfile> pairHighlights,
            LotteryKl8BacktestSummary backtestSummary) {
        if (candidatePool.size() < 5) {
            return LotteryKl8OptimizedPortfolio.empty();
        }
        Map<Integer, LotteryKl8NumberProfile> profileByNumber = profiles.stream()
                .collect(Collectors.toMap(LotteryKl8NumberProfile::number, profile -> profile));
        Map<String, Double> pairScores = pairHighlights.stream()
                .collect(Collectors.toMap(
                        pair -> pairKey(pair.leftNumber(), pair.rightNumber()),
                        LotteryKl8PairProfile::score,
                        (left, right) -> Math.max(left, right),
                        LinkedHashMap::new));
        List<Integer> candidates = candidatePool.stream()
                .map(LotteryKl8CandidateNumber::number)
                .distinct()
                .toList();
        Map<Integer, Integer> candidateRanks = new LinkedHashMap<>();
        for (int index = 0; index < candidates.size(); index += 1) {
            candidateRanks.put(candidates.get(index), index);
        }
        Map<Integer, Integer> reuseCounts = initNumberMap(0);
        List<LotteryKl8OptimizedGroup> groups = new ArrayList<>();
        Set<String> usedKeys = new HashSet<>();

        for (int groupIndex = 0; groupIndex < 5; groupIndex += 1) {
            List<Integer> selected = selectOptimizedNumbers(
                    groupIndex,
                    candidates,
                    candidateRanks,
                    reuseCounts,
                    profileByNumber,
                    pairScores,
                    backtestSummary.factorWeights());
            List<Integer> unique = ensureUniqueGroup(selected, usedKeys, candidates, reuseCounts);
            usedKeys.add(unique.toString());
            unique.forEach(number -> reuseCounts.put(number, reuseCounts.getOrDefault(number, 0) + 1));
            double groupScore = optimizedGroupScore(unique, profileByNumber, pairScores, backtestSummary.factorWeights());
            groups.add(new LotteryKl8OptimizedGroup(
                    unique,
                    groupScore,
                    "组合优化：结合滚动回测权重、候选池强度、组内共现和区间/奇偶/尾数分散生成，作为 AI 推荐的优先参考。",
                    optimizedEvidence(unique, groupScore, pairScores, reuseCounts, backtestSummary)));
        }

        double averageScore = groups.stream().mapToDouble(LotteryKl8OptimizedGroup::score).average().orElse(0);
        int maxReuse = reuseCounts.values().stream().max(Integer::compareTo).orElse(0);
        Map<String, String> diagnostics = new LinkedHashMap<>();
        diagnostics.put("averageGroupScore", "%.2f".formatted(averageScore));
        diagnostics.put("maxNumberReuse", String.valueOf(maxReuse));
        diagnostics.put("backtestAverageHit", "%.2f".formatted(backtestSummary.averageHitCount()));
        diagnostics.put("topFactors", String.join("、", backtestSummary.topFactorNames()));
        diagnostics.put("pairWeight", "%.2f".formatted(backtestSummary.factorWeights().pairWeight()));
        return new LotteryKl8OptimizedPortfolio(
                groups,
                "组合优化完成：基于 %d 个候选号码生成 5 组，最大单号复用 %d 次，平均组合分 %.2f，回测平均命中 %.2f。"
                        .formatted(candidates.size(), maxReuse, averageScore, backtestSummary.averageHitCount()),
                diagnostics);
    }

    private List<Integer> selectOptimizedNumbers(
            int groupIndex,
            List<Integer> candidates,
            Map<Integer, Integer> candidateRanks,
            Map<Integer, Integer> reuseCounts,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<String, Double> pairScores,
            LotteryKl8BacktestFactorWeights factorWeights) {
        List<Integer> selected = new ArrayList<>();
        while (selected.size() < 5) {
            Integer next = candidates.stream()
                    .filter(number -> !selected.contains(number))
                    .max(Comparator.comparingDouble(number -> optimizedMemberScore(
                            number,
                            selected,
                            groupIndex,
                            candidateRanks,
                            reuseCounts,
                            profileByNumber,
                            pairScores,
                            factorWeights)))
                    .orElse(null);
            if (next == null) {
                break;
            }
            selected.add(next);
        }
        return selected.stream().sorted().toList();
    }

    private double optimizedMemberScore(
            int number,
            List<Integer> selected,
            int groupIndex,
            Map<Integer, Integer> candidateRanks,
            Map<Integer, Integer> reuseCounts,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<String, Double> pairScores,
            LotteryKl8BacktestFactorWeights factorWeights) {
        LotteryKl8NumberProfile profile = profileByNumber.get(number);
        double baseScore = profile == null ? 0 : profile.compositeScore();
        int reuseCount = reuseCounts.getOrDefault(number, 0);
        double reusePenalty = reuseCount >= 2 ? 120 : reuseCount * 20;
        long sameRangeCount = selected.stream().filter(existing -> rangeLabel(existing).equals(rangeLabel(number))).count();
        long sameParityCount = selected.stream().filter(existing -> existing % 2 == number % 2).count();
        long sameTailCount = selected.stream().filter(existing -> Math.floorMod(existing, 10) == Math.floorMod(number, 10)).count();
        double structurePenalty = Math.max(0, sameRangeCount - 1) * 14
                + Math.max(0, sameParityCount - 2) * 10
                + sameTailCount * 6;
        double pairBonus = Math.min(22, pairBonus(number, selected, pairScores) * factorWeights.pairWeight());
        int shiftedRank = Math.floorMod(candidateRanks.getOrDefault(number, 0) - groupIndex * 5, Math.max(1, candidatesSize(candidateRanks)));
        double rotationPenalty = shiftedRank * 0.12;
        return baseScore + pairBonus - reusePenalty - structurePenalty - rotationPenalty;
    }

    private int candidatesSize(Map<Integer, Integer> candidateRanks) {
        return Math.max(1, candidateRanks.size());
    }

    private List<Integer> ensureUniqueGroup(
            List<Integer> selected,
            Set<String> usedKeys,
            List<Integer> candidates,
            Map<Integer, Integer> reuseCounts) {
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
                if (unique.size() == 5 && !usedKeys.contains(unique.toString())) {
                    return unique;
                }
            }
        }
        return sorted;
    }

    private double optimizedGroupScore(
            List<Integer> numbers,
            Map<Integer, LotteryKl8NumberProfile> profileByNumber,
            Map<String, Double> pairScores,
            LotteryKl8BacktestFactorWeights factorWeights) {
        double base = numbers.stream()
                .map(profileByNumber::get)
                .filter(profile -> profile != null)
                .mapToDouble(LotteryKl8NumberProfile::compositeScore)
                .average()
                .orElse(0);
        double pairBonus = 0;
        for (int leftIndex = 0; leftIndex < numbers.size(); leftIndex += 1) {
            for (int rightIndex = leftIndex + 1; rightIndex < numbers.size(); rightIndex += 1) {
                pairBonus += pairScores.getOrDefault(pairKey(numbers.get(leftIndex), numbers.get(rightIndex)), 0.0);
            }
        }
        return round(base + Math.min(20, pairBonus * factorWeights.pairWeight() / 4)
                - structurePenalty(numbers));
    }

    private double structurePenalty(List<Integer> numbers) {
        double penalty = 0;
        for (Long count : rangeDistribution(numbers).values()) {
            if (count > 2) {
                penalty += (count - 2) * 8;
            }
        }
        for (Long count : parityDistribution(numbers).values()) {
            if (count > 3) {
                penalty += (count - 3) * 8;
            }
        }
        return penalty;
    }

    private List<String> optimizedEvidence(
            List<Integer> numbers,
            double groupScore,
            Map<String, Double> pairScores,
            Map<Integer, Integer> reuseCounts,
            LotteryKl8BacktestSummary backtestSummary) {
        double pairBonus = 0;
        for (int leftIndex = 0; leftIndex < numbers.size(); leftIndex += 1) {
            for (int rightIndex = leftIndex + 1; rightIndex < numbers.size(); rightIndex += 1) {
                pairBonus += pairScores.getOrDefault(pairKey(numbers.get(leftIndex), numbers.get(rightIndex)), 0.0);
            }
        }
        int maxReuse = numbers.stream().mapToInt(number -> reuseCounts.getOrDefault(number, 0)).max().orElse(0);
        return List.of(
                "组合分 %.2f，回测平均命中 %.2f".formatted(groupScore, backtestSummary.averageHitCount()),
                "区间分布 " + rangeDistribution(numbers) + "，奇偶分布 " + parityDistribution(numbers),
                "尾数分布 " + tailDistribution(numbers) + "，组内共现加成 %.2f".formatted(pairBonus),
                "本组号码最大复用次数 " + maxReuse + "，优先因子 " + backtestSummary.topFactorNames());
    }

    private double pairBonus(int number, List<Integer> selected, Map<String, Double> pairScores) {
        return selected.stream()
                .mapToDouble(existing -> pairScores.getOrDefault(pairKey(number, existing), 0.0))
                .sum();
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
            LotteryKl8OptimizedPortfolio optimizedPortfolio) {
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
        sections.add("结构层：区间分布 %s，尾数分布高位 %s，组合时会约束区间、奇偶和尾数不要过度集中。"
                .formatted(ranges, topEntries(tailCounts, 4)));
        if (!pairHighlights.isEmpty()) {
            LotteryKl8PairProfile pair = pairHighlights.get(0);
            sections.add("共现层：%d-%d 在样本内共现 %d 次，lift %.2f，只作为组合参考，不直接视为因果。"
                    .formatted(pair.leftNumber(), pair.rightNumber(), pair.count(), pair.lift()));
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
