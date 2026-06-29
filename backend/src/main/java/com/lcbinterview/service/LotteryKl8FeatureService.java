package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private static final int CANDIDATE_POOL_SIZE = 32;
    private static final int PAIR_HIGHLIGHT_SIZE = 20;

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
        int limit = Math.max(20, Math.min(500, baseIssueCount));
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
        List<LotteryKl8NumberProfile> profiles = buildNumberProfiles(
                drawSets,
                frequency,
                missing,
                hot,
                cold,
                calibrationToUse);
        List<LotteryKl8CandidateNumber> candidatePool = buildCandidatePool(profiles);
        List<LotteryKl8PairProfile> pairHighlights = buildPairHighlights(drawSets, frequency);
        List<String> analysisSections = buildAnalysisSections(
                draws.size(),
                hot,
                cold,
                ranges,
                tailCounts,
                candidatePool,
                pairHighlights,
                calibrationToUse);
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
                analysisSections,
                buildSummary(draws.size(), latestIssueNo, hot, cold, ranges, odd, even),
                buildDeepSummary(draws.size(), latestIssueNo, candidatePool, pairHighlights, analysisSections));
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
            LotteryKl8StrategyCalibration calibration) {
        int total = drawSets.size();
        int recent30Window = Math.min(30, total);
        int recent60Window = Math.min(60, total);
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
            int previous30 = countInWindow(drawSets, number, previousStart, previousEnd);
            double trendScore = trendScore(recent30, recent30Window, previous30, previousEnd - previousStart);
            double volatility = volatility(drawSets, number, 10);
            OmissionStats omissionStats = omissionStats(drawSets, number);
            double frequencyScore = maxFrequency == 0 ? 0 : (double) currentFrequency / maxFrequency;
            double missingScore = maxMissing == 0 ? 0 : (double) missing.getOrDefault(number, total) / maxMissing;
            double recentScore = recent30Window == 0 ? 0 : (double) recent30 / recent30Window;
            double trendPositive = Math.max(0, trendScore) * 3;
            double stabilityScore = Math.max(0, 1 - volatility / 4);
            double coldRecoveryScore = coldSet.contains(number)
                    ? Math.min(1, missingScore + Math.max(0, trendScore) * 2)
                    : 0;
            double compositeScore = round((frequencyScore * 35 + recentScore * 25) * calibration.hotMultiplier()
                    + missingScore * 18 * calibration.missingMultiplier()
                    + Math.min(1, trendPositive) * 15 * calibration.trendMultiplier()
                    + stabilityScore * 7 * calibration.balanceMultiplier()
                    + coldRecoveryScore * 8 * (calibration.coldMultiplier() - 1));
            List<String> tags = tags(number, hotSet, coldSet, missing, trendScore, volatility, recent30);
            profiles.add(new LotteryKl8NumberProfile(
                    number,
                    currentFrequency,
                    round((double) currentFrequency / total),
                    recent30,
                    recent60,
                    missing.getOrDefault(number, total),
                    omissionStats.averageMissing(),
                    omissionStats.maxMissing(),
                    round(trendScore),
                    round(volatility),
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
            int recent30) {
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
            LotteryKl8StrategyCalibration calibration) {
        List<String> sections = new ArrayList<>();
        if (calibration.evaluatedCount() > 0) {
            sections.add("校准层：" + calibration.summary());
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
            List<String> analysisSections) {
        String pairText = pairHighlights.isEmpty()
                ? "暂无明显共现对"
                : "%d-%d 共现 %d 次".formatted(pairHighlights.get(0).leftNumber(),
                pairHighlights.get(0).rightNumber(), pairHighlights.get(0).count());
        return "近 %d 期深度分析，最新期号 %s。候选池 %d 个号码，前 8 个为 %s；共现参考：%s。%s"
                .formatted(count, latestIssueNo, candidatePool.size(),
                        candidatePool.stream().limit(8).map(LotteryKl8CandidateNumber::number).toList(),
                        pairText,
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
}
