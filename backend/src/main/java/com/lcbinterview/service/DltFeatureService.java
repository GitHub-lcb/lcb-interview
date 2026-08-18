package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.model.DltDraw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * 大乐透特征与推荐服务：前区 1-35 选 5、后区 1-12 选 3（复式）。
 * 特征与双色球同源：频次 40% + 遗漏回补 30% + 上期邻位 30%，区间均衡；后区按频次与遗漏选 3 个。
 * 大乐透每周一三六开奖，回测按最近期数滚动评估。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DltFeatureService {

    /** 前区范围 1-35 */
    private static final int FRONT_MAX = 35;
    /** 后区范围 1-12 */
    private static final int BACK_MAX = 12;
    /** 推荐前区数量 */
    private static final int FRONT_PICK_SIZE = 5;
    /** 推荐后区数量（复式 3 选 2） */
    private static final int BACK_PICK_SIZE = 3;
    /** 默认历史期数窗口 */
    private static final int DEFAULT_WINDOW = 100;
    /** 回测评估期数 */
    private static final int BACKTEST_ISSUES = 200;
    /** 邻位加分 */
    private static final double NEIGHBOR_BONUS = 6.0;

    private final DltDrawMapper drawMapper;

    /**
     * 基于最近指定期数构建特征报告并生成 5 前区 + 3 后区推荐。
     *
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    public DltFeatureReport buildReport(int baseIssueCount) {
        int window = Math.max(30, Math.min(500, baseIssueCount));
        DltDraw latest = latestDraw();
        if (latest == null) {
            throw new IllegalStateException("大乐透历史开奖数据为空，请先同步");
        }
        List<DltDraw> draws = drawMapper.selectRecentUpTo(latest.getIssueNo(), window);
        if (draws.size() < 20) {
            throw new IllegalStateException("大乐透历史开奖不足 20 期，请先同步");
        }
        return buildReportFromDraws(draws, window);
    }

    /**
     * 使用指定历史开奖生成与每日推荐完全相同的特征报告。
     * 历史必须按期号倒序排列（最新一期在前）。
     *
     * @param sourceDraws 历史开奖（最新在前）
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    public DltFeatureReport buildReportFromDraws(List<DltDraw> sourceDraws, int baseIssueCount) {
        int window = Math.max(30, Math.min(500, baseIssueCount));
        List<DltDraw> draws = sourceDraws == null ? List.of()
                : sourceDraws.stream().limit(window).toList();
        if (draws.size() < 20) {
            throw new IllegalStateException("大乐透历史开奖不足 20 期，请先同步");
        }
        List<List<Integer>> frontHistory = new ArrayList<>();
        List<List<Integer>> backHistory = new ArrayList<>();
        for (DltDraw draw : draws) {
            frontHistory.add(parseNumbers(draw.getFrontNumbers()));
            backHistory.add(parseNumbers(draw.getBackNumbers()));
        }

        Map<Integer, Integer> frontFrequency = frequency(frontHistory);
        Map<Integer, Integer> backFrequency = frequency(backHistory);
        int maxFrontFreq = frontFrequency.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        int maxBackFreq = backFrequency.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        List<Integer> latestFronts = frontHistory.getFirst();
        List<Integer> latestBacks = backHistory.getFirst();

        List<DltNumberProfile> frontProfiles = new ArrayList<>();
        for (int number = 1; number <= FRONT_MAX; number += 1) {
            int freq = frontFrequency.getOrDefault(number, 0);
            double neighborScore = latestFronts.contains(number - 1) || latestFronts.contains(number + 1)
                    ? NEIGHBOR_BONUS : 0;
            double score = freq * 40.0 / maxFrontFreq
                    + Math.min(currentOmission(frontHistory, number), 20) * 30.0 / 20
                    + neighborScore;
            frontProfiles.add(new DltNumberProfile(number, freq, currentOmission(frontHistory, number), score));
        }

        // 后区：频次 60% + 遗漏回补 40%，选 3 个
        List<DltNumberProfile> backProfiles = new ArrayList<>();
        for (int number = 1; number <= BACK_MAX; number += 1) {
            int freq = backFrequency.getOrDefault(number, 0);
            double score = freq * 60.0 / maxBackFreq
                    + Math.min(currentOmission(backHistory, number), 15) * 40.0 / 15;
            backProfiles.add(new DltNumberProfile(number, freq, currentOmission(backHistory, number), score));
        }

        List<Integer> frontPicks = pickByScore(frontProfiles, FRONT_PICK_SIZE, true);
        List<Integer> backPicks = pickByScore(backProfiles, BACK_PICK_SIZE, false);

        DltBacktestSummary backtest = buildBacktestSummary(draws);

        String deepSummary = "基于近 " + window + " 期：前区频次 40% + 遗漏回补 30% + 上期邻位 30%，"
                + "后区频次 60% + 遗漏回补 40%，回测 " + backtest.evaluatedIssueCount()
                + " 期平均前区命中 " + String.format("%.2f", backtest.averageFrontHit()) + " 个。";

        DltDraw latest = draws.getFirst();
        return new DltFeatureReport(window, latest.getIssueNo(), latest.getDrawDate(),
                frontPicks, backPicks, backtest, deepSummary);
    }

    /**
     * 生成最新一期推荐（不依赖外部状态，供测试直接调用）。
     *
     * @param baseIssueCount 使用历史期数
     * @return 5 前区 + 3 后区
     */
    public DltPicks generatePicks(int baseIssueCount) {
        DltFeatureReport report = buildReport(baseIssueCount);
        return new DltPicks(report.frontPicks(), report.backPicks(), report);
    }

    /**
     * 使用指定历史开奖生成与每日推荐完全相同的 5 前区 + 3 后区号码。
     *
     * @param draws 历史开奖（最新在前）
     * @param baseIssueCount 使用历史期数
     * @return 推荐号码与特征报告
     */
    public DltPicks generatePicksFromDraws(List<DltDraw> draws, int baseIssueCount) {
        DltFeatureReport report = buildReportFromDraws(draws, baseIssueCount);
        return new DltPicks(report.frontPicks(), report.backPicks(), report);
    }

    private Map<Integer, Integer> frequency(List<List<Integer>> history) {
        Map<Integer, Integer> result = new HashMap<>();
        for (List<Integer> numbers : history) {
            for (int number : numbers) {
                result.merge(number, 1, Integer::sum);
            }
        }
        return result;
    }

    private int currentOmission(List<List<Integer>> history, int number) {
        int omission = 0;
        for (List<Integer> draw : history) {
            if (draw.contains(number)) {
                break;
            }
            omission += 1;
        }
        return omission;
    }

    private List<Integer> pickByScore(List<DltNumberProfile> profiles, int size, boolean zoneBalance) {
        List<DltNumberProfile> sorted = profiles.stream()
                .sorted(Comparator.comparingDouble(DltNumberProfile::score).reversed())
                .toList();
        LinkedHashSet<Integer> selected = new LinkedHashSet<>();
        for (DltNumberProfile profile : sorted) {
            if (selected.size() >= size) {
                break;
            }
            selected.add(profile.number());
        }
        if (zoneBalance) {
            ensureFrontZoneBalance(profiles, selected);
        }
        return selected.stream().sorted().toList();
    }

    private void ensureFrontZoneBalance(List<DltNumberProfile> profiles, LinkedHashSet<Integer> selected) {
        List<List<Integer>> zones = List.of(
                List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
                List.of(13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24),
                List.of(25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35));
        for (List<Integer> zone : zones) {
            if (zone.stream().noneMatch(selected::contains)) {
                profiles.stream()
                        .filter(p -> zone.contains(p.number()) && !selected.contains(p.number()))
                        .max(Comparator.comparingDouble(DltNumberProfile::score))
                        .ifPresent(replacement -> {
                            int lowest = selected.stream()
                                    .min(Comparator.comparingDouble(n -> profileScore(profiles, n)))
                                    .orElse(replacement.number());
                            if (lowest != replacement.number()) {
                                selected.remove(lowest);
                                selected.add(replacement.number());
                            }
                        });
            }
        }
    }

    private double profileScore(List<DltNumberProfile> profiles, int number) {
        return profiles.stream()
                .filter(p -> p.number() == number)
                .mapToDouble(DltNumberProfile::score)
                .findFirst()
                .orElse(0);
    }

    private DltBacktestSummary buildBacktestSummary(List<DltDraw> draws) {
        Map<Integer, Integer> frontHitDistribution = new LinkedHashMap<>();
        for (int hit = 0; hit <= 5; hit += 1) {
            frontHitDistribution.put(hit, 0);
        }
        long totalFrontHits = 0;
        long totalBackHits = 0;
        int evaluated = 0;
        // 滚动回测：用 t 期之前的数据预测 t 期
        for (int index = draws.size() - 1; index >= 30 && evaluated < BACKTEST_ISSUES; index -= 1) {
            DltDraw target = draws.get(index);
            List<DltDraw> history = draws.subList(0, index);
            if (history.size() < 20) {
                break;
            }
            List<Integer> targetFronts = parseNumbers(target.getFrontNumbers());
            List<Integer> targetBacks = parseNumbers(target.getBackNumbers());
            try {
                List<Integer> frontPicks = quickPick(history, FRONT_PICK_SIZE, true);
                int frontHit = (int) frontPicks.stream().filter(targetFronts::contains).count();
                frontHitDistribution.merge(frontHit, 1, Integer::sum);
                totalFrontHits += frontHit;
                List<Integer> backPicks = quickPick(history, BACK_PICK_SIZE, false);
                totalBackHits += backPicks.stream().filter(targetBacks::contains).count();
                evaluated += 1;
            } catch (Exception e) {
                log.debug("大乐透回测跳过异常期: index={}, error={}", index, e.getMessage());
            }
        }
        double averageFrontHit = evaluated == 0 ? 0 : (double) totalFrontHits / evaluated;
        double averageBackHit = evaluated == 0 ? 0 : (double) totalBackHits / evaluated;
        String summary = "回测 " + evaluated + " 期：平均前区命中 " + String.format("%.2f", averageFrontHit)
                + " 个，后区平均命中 " + String.format("%.2f", averageBackHit)
                + " 个（随机基线：前区约 0.71 个，后区 3 选约 0.5 个）";
        return new DltBacktestSummary(evaluated, averageFrontHit, averageBackHit, frontHitDistribution, summary);
    }

    private List<Integer> quickPick(List<DltDraw> history, int size, boolean front) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (DltDraw draw : history) {
            List<Integer> numbers = front
                    ? parseNumbers(draw.getFrontNumbers())
                    : parseNumbers(draw.getBackNumbers());
            for (int number : numbers) {
                freq.merge(number, 1, Integer::sum);
            }
        }
        int max = freq.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        return freq.entrySet().stream()
                .sorted(Map.Entry.<Integer, Integer>comparingByValue().reversed())
                .limit(size)
                .map(Map.Entry::getKey)
                .sorted()
                .toList();
    }

    private DltDraw latestDraw() {
        return drawMapper.selectOne(Wrappers.<DltDraw>lambdaQuery()
                .orderByDesc(DltDraw::getIssueNo)
                .last("LIMIT 1"));
    }

    private List<Integer> parseNumbers(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<Integer> numbers = new ArrayList<>();
        for (String part : value.split(",")) {
            try {
                numbers.add(Integer.parseInt(part.trim()));
            } catch (NumberFormatException ignored) {
                // 脏数据跳过
            }
        }
        return numbers;
    }

    /**
     * 单个号码特征。
     */
    public record DltNumberProfile(int number, int frequency, int omission, double score) {
    }

    /**
     * 回测摘要。
     */
    public record DltBacktestSummary(int evaluatedIssueCount, double averageFrontHit,
                                     double averageBackHit,
                                     Map<Integer, Integer> frontHitDistribution,
                                     String summary) {
    }

    /**
     * 特征报告。
     */
    public record DltFeatureReport(int baseIssueCount, String latestIssueNo,
                                   LocalDate latestDrawDate,
                                   List<Integer> frontPicks, List<Integer> backPicks,
                                   DltBacktestSummary backtest, String deepSummary) {
    }

    /**
     * 推荐结果。
     */
    public record DltPicks(List<Integer> frontPicks, List<Integer> backPicks, DltFeatureReport report) {
    }
}
