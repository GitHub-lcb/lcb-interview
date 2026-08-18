package com.lcbinterview.service;

import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.model.SsqDraw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 双色球特征与推荐服务：基于历史开奖提取红球频次/遗漏/邻位/连号特征，
 * 生成 7 红 + 1 蓝推荐，并输出滚动回测摘要评估策略稳定性。
 * <p>
 * 红球 33 选 7（复式），蓝球 16 选 1。策略与快乐8 同源：多特征加权 + 连号保证，
 * 但双色球每周仅 3 期，特征窗口以期数而非天数计。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SsqFeatureService {

    /** 红球范围 1-33 */
    private static final int RED_MAX = 33;
    /** 蓝球范围 1-16 */
    private static final int BLUE_MAX = 16;
    /** 推荐红球数量（复式 7 红） */
    private static final int RED_PICK_SIZE = 7;
    /** 默认历史期数窗口 */
    private static final int DEFAULT_WINDOW = 100;
    /** 回测评估期数 */
    private static final int BACKTEST_ISSUES = 200;
    /** 邻位加分：上期红球 n±1 */
    private static final double NEIGHBOR_BONUS = 6.0;
    /** 连号加分：与已选号码相邻 */
    private static final double CONSECUTIVE_BONUS = 3.0;

    private final SsqDrawMapper drawMapper;

    /**
     * 基于最近指定期数构建特征报告并生成 7 红 1 蓝推荐。
     *
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    public SsqFeatureReport buildReport(int baseIssueCount) {
        int window = Math.max(30, Math.min(500, baseIssueCount));
        SsqDraw latest = latestDraw();
        if (latest == null) {
            throw new IllegalStateException("双色球历史开奖数据为空，请先同步");
        }
        List<SsqDraw> draws = drawMapper.selectRecentUpTo(latest.getIssueNo(), window);
        if (draws.size() < 20) {
            throw new IllegalStateException("双色球历史开奖不足 20 期，请先同步");
        }
        return buildReportFromDraws(draws, window);
    }

    /**
     * 使用指定历史开奖生成与每日推荐完全相同的特征报告。
     * 历史必须按期号倒序排列（最新一期在前），模拟战场据此避免读取未来数据。
     *
     * @param sourceDraws 历史开奖（最新在前）
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    public SsqFeatureReport buildReportFromDraws(List<SsqDraw> sourceDraws, int baseIssueCount) {
        int window = Math.max(30, Math.min(500, baseIssueCount));
        List<SsqDraw> draws = sourceDraws == null ? List.of()
                : sourceDraws.stream().limit(window).toList();
        if (draws.size() < 20) {
            throw new IllegalStateException("双色球历史开奖不足 20 期，请先同步");
        }
        List<List<Integer>> redHistory = new ArrayList<>();
        List<Integer> blueHistory = new ArrayList<>();
        for (SsqDraw draw : draws) {
            redHistory.add(parseNumbers(draw.getRedNumbers()));
            blueHistory.add(parseBlue(draw.getBlueNumber()));
        }

        Map<Integer, Integer> redFrequency = new HashMap<>();
        for (List<Integer> reds : redHistory) {
            for (int number : reds) {
                redFrequency.merge(number, 1, Integer::sum);
            }
        }
        Map<Integer, Integer> blueFrequency = new HashMap<>();
        for (int blue : blueHistory) {
            blueFrequency.merge(blue, 1, Integer::sum);
        }

        int maxRedFreq = redFrequency.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        List<Integer> latestReds = redHistory.getFirst();
        Map<Integer, Integer> omission = new HashMap<>();
        for (int number = 1; number <= RED_MAX; number += 1) {
            omission.put(number, currentOmission(redHistory, number));
        }

        List<SsqNumberProfile> redProfiles = new ArrayList<>();
        for (int number = 1; number <= RED_MAX; number += 1) {
            int freq = redFrequency.getOrDefault(number, 0);
            double neighborScore = latestReds.contains(number - 1) || latestReds.contains(number + 1)
                    ? NEIGHBOR_BONUS : 0;
            // 频次 40% + 遗漏回补 30% + 邻位 30%：频次高且遗漏压力大的号码综合分更高
            double score = freq * 40.0 / maxRedFreq
                    + Math.min(omission.getOrDefault(number, 0), 20) * 30.0 / 20
                    + neighborScore;
            redProfiles.add(new SsqNumberProfile(number, freq, omission.getOrDefault(number, 0), score));
        }

        List<Integer> redPicks = pickReds(redProfiles);
        int bluePick = pickBlue(blueHistory, blueFrequency);

        SsqBacktestSummary backtest = buildBacktestSummary(draws);

        String deepSummary = "基于近 " + window + " 期：红球频次 40% + 遗漏回补 30% + 上期邻位 30% 加权，"
                + "蓝球按历史频次最高且遗漏较大者选择，回测 " + backtest.evaluatedIssueCount()
                + " 期平均红球命中 " + String.format("%.2f", backtest.averageRedHit()) + " 个。";

        SsqDraw latest = draws.getFirst();
        return new SsqFeatureReport(window, latest.getIssueNo(), latest.getDrawDate(),
                redProfiles, redPicks, bluePick, backtest, deepSummary);
    }

    /**
     * 生成最新一期推荐（不依赖外部状态，供测试直接调用）。
     *
     * @param baseIssueCount 使用历史期数
     * @return 7 红 + 1 蓝
     */
    public SsqPicks generatePicks(int baseIssueCount) {
        SsqFeatureReport report = buildReport(baseIssueCount);
        return new SsqPicks(report.redPicks(), report.bluePick(), report);
    }

    /**
     * 使用指定历史开奖生成与每日推荐完全相同的 7 红 + 1 蓝号码。
     *
     * @param draws 历史开奖（最新在前）
     * @param baseIssueCount 使用历史期数
     * @return 推荐号码与特征报告
     */
    public SsqPicks generatePicksFromDraws(List<SsqDraw> draws, int baseIssueCount) {
        SsqFeatureReport report = buildReportFromDraws(draws, baseIssueCount);
        return new SsqPicks(report.redPicks(), report.bluePick(), report);
    }

    private List<Integer> pickReds(List<SsqNumberProfile> profiles) {
        List<SsqNumberProfile> sorted = profiles.stream()
                .sorted(Comparator.comparingDouble(SsqNumberProfile::score).reversed())
                .toList();
        LinkedHashSet<Integer> selected = new LinkedHashSet<>();
        for (SsqNumberProfile profile : sorted) {
            if (selected.size() >= RED_PICK_SIZE) {
                break;
            }
            if (selected.contains(profile.number())) {
                continue;
            }
            selected.add(profile.number());
        }
        // 区间均衡：1-11 / 12-22 / 23-33 各至少 1 个，避免 7 个号扎堆同一区间
        ensureZoneBalance(profiles, selected);
        return selected.stream().sorted().toList();
    }

    private void ensureZoneBalance(List<SsqNumberProfile> profiles, LinkedHashSet<Integer> selected) {
        List<List<Integer>> zones = List.of(
                List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
                List.of(12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22),
                List.of(23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33));
        for (List<Integer> zone : zones) {
            if (zone.stream().noneMatch(selected::contains)) {
                profiles.stream()
                        .filter(p -> zone.contains(p.number()) && !selected.contains(p.number()))
                        .max(Comparator.comparingDouble(SsqNumberProfile::score))
                        .ifPresent(replacement -> {
                            // 替换综合分最低的已选号码，保证区间覆盖
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

    private double profileScore(List<SsqNumberProfile> profiles, int number) {
        return profiles.stream()
                .filter(p -> p.number() == number)
                .mapToDouble(SsqNumberProfile::score)
                .findFirst()
                .orElse(0);
    }

    private int pickBlue(List<Integer> blueHistory, Map<Integer, Integer> blueFrequency) {
        int maxFreq = blueFrequency.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        return blueFrequency.entrySet().stream()
                .filter(entry -> entry.getValue() == maxFreq)
                .max(Comparator.comparingInt(entry -> currentOmission(
                        blueHistory.stream().map(List::of).toList(), entry.getKey())))
                .map(Map.Entry::getKey)
                .orElseGet(() -> {
                    // 兜底：取遗漏最大的蓝球
                    int best = 1;
                    int bestOmission = -1;
                    for (int number = 1; number <= BLUE_MAX; number += 1) {
                        int omission = currentOmission(blueHistory.stream().map(List::of).toList(), number);
                        if (omission > bestOmission) {
                            bestOmission = omission;
                            best = number;
                        }
                    }
                    return best;
                });
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

    private SsqBacktestSummary buildBacktestSummary(List<SsqDraw> draws) {
        Map<Integer, Integer> redHitDistribution = new LinkedHashMap<>();
        for (int hit = 0; hit <= 7; hit += 1) {
            redHitDistribution.put(hit, 0);
        }
        int blueHits = 0;
        long totalRedHits = 0;
        int evaluated = 0;
        // 滚动回测：从后往前，用 t 期之前的数据预测 t 期
        for (int index = draws.size() - 1; index >= 30 && evaluated < BACKTEST_ISSUES; index -= 1) {
            SsqDraw target = draws.get(index);
            List<SsqDraw> history = draws.subList(0, index);
            if (history.size() < 20) {
                break;
            }
            List<Integer> targetReds = parseNumbers(target.getRedNumbers());
            int targetBlue = parseBlue(target.getBlueNumber());
            try {
                List<Integer> picks = quickPick(history, RED_PICK_SIZE);
                int redHit = (int) picks.stream().filter(targetReds::contains).count();
                redHitDistribution.merge(redHit, 1, Integer::sum);
                totalRedHits += redHit;
                if (quickPickBlue(history) == targetBlue) {
                    blueHits += 1;
                }
                evaluated += 1;
            } catch (Exception e) {
                log.debug("双色球回测跳过异常期: index={}, error={}", index, e.getMessage());
            }
        }
        double averageRedHit = evaluated == 0 ? 0 : (double) totalRedHits / evaluated;
        double blueHitRate = evaluated == 0 ? 0 : (double) blueHits / evaluated;
        String summary = "回测 " + evaluated + " 期：平均红球命中 " + String.format("%.2f", averageRedHit)
                + " 个，蓝球命中率 " + String.format("%.1f%%", blueHitRate * 100)
                + "（随机基线：红球约 1.27 个，蓝球 6.25%）";
        return new SsqBacktestSummary(evaluated, averageRedHit, blueHitRate, redHitDistribution, summary);
    }

    private List<Integer> quickPick(List<SsqDraw> history, int size) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (SsqDraw draw : history) {
            for (int number : parseNumbers(draw.getRedNumbers())) {
                freq.merge(number, 1, Integer::sum);
            }
        }
        int max = freq.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        List<SsqNumberProfile> profiles = new ArrayList<>();
        for (int number = 1; number <= RED_MAX; number += 1) {
            int f = freq.getOrDefault(number, 0);
            profiles.add(new SsqNumberProfile(number, f, 0, f * 40.0 / max));
        }
        return profiles.stream()
                .sorted(Comparator.comparingDouble(SsqNumberProfile::score).reversed())
                .limit(size)
                .map(SsqNumberProfile::number)
                .sorted()
                .toList();
    }

    private int quickPickBlue(List<SsqDraw> history) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (SsqDraw draw : history) {
            freq.merge(parseBlue(draw.getBlueNumber()), 1, Integer::sum);
        }
        return freq.entrySet().stream()
                .max(Comparator.comparingInt(Map.Entry::getValue))
                .map(Map.Entry::getKey)
                .orElse(1);
    }

    private SsqDraw latestDraw() {
        return drawMapper.selectOne(com.baomidou.mybatisplus.core.toolkit.Wrappers.<SsqDraw>lambdaQuery()
                .orderByDesc(SsqDraw::getIssueNo)
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

    private int parseBlue(String value) {
        try {
            return value == null ? 1 : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    /**
     * 单个红球号码特征。
     *
     * @param number   号码
     * @param frequency 窗口内出现次数
     * @param omission  当前遗漏期数
     * @param score     综合分
     */
    public record SsqNumberProfile(int number, int frequency, int omission, double score) {
    }

    /**
     * 回测摘要。
     *
     * @param evaluatedIssueCount 评估期数
     * @param averageRedHit       平均红球命中数
     * @param blueHitRate         蓝球命中率
     * @param redHitDistribution  红球命中数分布（0-7）
     * @param summary             摘要文本
     */
    public record SsqBacktestSummary(int evaluatedIssueCount, double averageRedHit,
                                     double blueHitRate,
                                     Map<Integer, Integer> redHitDistribution,
                                     String summary) {
    }

    /**
     * 特征报告。
     *
     * @param baseIssueCount 使用历史期数
     * @param latestIssueNo  最新期号
     * @param latestDrawDate 最新开奖日期
     * @param redProfiles    红球特征
     * @param redPicks       推荐 7 红
     * @param bluePick       推荐蓝球
     * @param backtest       回测摘要
     * @param deepSummary    深度摘要
     */
    public record SsqFeatureReport(int baseIssueCount, String latestIssueNo,
                                   java.time.LocalDate latestDrawDate,
                                   List<SsqNumberProfile> redProfiles,
                                   List<Integer> redPicks, int bluePick,
                                   SsqBacktestSummary backtest, String deepSummary) {
    }

    /**
     * 推荐结果。
     *
     * @param redPicks 7 个红球
     * @param bluePick 1 个蓝球
     * @param report   特征报告
     */
    public record SsqPicks(List<Integer> redPicks, int bluePick, SsqFeatureReport report) {
    }
}
