package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotterySimulationVO;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.LotterySimulationMapper;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.DltDraw;
import com.lcbinterview.model.LotterySimulation;
import com.lcbinterview.model.SsqDraw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 彩票模拟战场服务：选择最近 N 期（10-1000），假设全部未开，
 * 逐期用「该期之前的历史」预测下一期并结算，最终统计命中表现。
 * <p>
 * 三种玩法独立预测口径：
 * - KL8：选4 × 2 组，统计单组最高命中与两组总命中
 * - SSQ：7 红 + 1 蓝，统计红球命中与蓝球命中率
 * - DLT：5 前区 + 3 后区，统计前区命中与后区命中
 * <p>
 * 模拟只读历史开奖、逐期滚动，不影响线上推荐记录。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotterySimulationService {

    /** 每期预测使用的前置历史期数（窗口外真实历史，保证特征数据充足） */
    private static final int LEAD_HISTORY = 50;
    private static final int MIN_WINDOW = 10;
    private static final int MAX_WINDOW = 1000;

    private final LotteryKl8DrawMapper kl8DrawMapper;
    private final SsqDrawMapper ssqDrawMapper;
    private final DltDrawMapper dltDrawMapper;
    private final LotterySimulationMapper simulationMapper;
    private final ObjectMapper objectMapper;

    /**
     * 执行一次模拟并保存结果。
     *
     * @param userId     用户 ID
     * @param lotteryType 模拟类型：KL8/SSQ/DLT
     * @param windowSize  模拟期数（10-1000）
     * @return 模拟结果
     */
    @Transactional
    public LotterySimulationVO run(Long userId, String lotteryType, int windowSize) {
        int window = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, windowSize));
        String type = lotteryType == null ? "" : lotteryType.trim().toUpperCase();
        SimulationStats stats;
        List<SimulationEntry> entries;
        switch (type) {
            case "KL8" -> {
                List<SimulationDraw> draws = loadKl8Draws(window);
                entries = simulateKl8(draws, window);
                stats = aggregate(entries, true);
            }
            case "SSQ" -> {
                List<SimulationDraw> draws = loadSsqDraws(window);
                entries = simulateSsq(draws, window);
                stats = aggregate(entries, false);
            }
            case "DLT" -> {
                List<SimulationDraw> draws = loadDltDraws(window);
                entries = simulateDlt(draws, window);
                stats = aggregate(entries, false);
            }
            default -> throw new BusinessException(400, "模拟类型仅支持 KL8/SSQ/DLT");
        }

        LotterySimulation simulation = new LotterySimulation();
        simulation.setUserId(userId);
        simulation.setLotteryType(type);
        simulation.setWindowSize(window);
        simulation.setLeadHistory(LEAD_HISTORY);
        simulation.setStartIssueNo(entries.isEmpty() ? "" : entries.getFirst().issueNo());
        simulation.setEndIssueNo(entries.isEmpty() ? "" : entries.getLast().issueNo());
        simulation.setEvaluatedCount(entries.size());
        simulation.setTotalHits(stats.totalHits());
        simulation.setAvgHits(stats.avgHits());
        simulation.setHitRate(stats.hitRate());
        simulation.setZeroHitCount(stats.zeroHitCount());
        simulation.setMaxHits(stats.maxHits());
        simulation.setSecondaryAvg(stats.secondaryAvg());
        simulation.setHit4Count(stats.hit4Count());
        simulation.setHitDistributionJson(writeDistributionJson(stats.distribution()));
        simulation.setResultJson(writeResultJson(entries));
        simulation.setSummary(buildSummary(type, window, stats));
        simulationMapper.insert(simulation);
        log.info("模拟战场完成: userId={}, type={}, window={}, 结算 {} 期, 平均命中 {}",
                userId, type, window, entries.size(), stats.avgHits());
        return toVo(simulation);
    }

    /**
     * 分页查询当前用户的模拟记录。
     *
     * @param userId 用户 ID
     * @param page   页码
     * @param size   每页条数
     * @return 模拟记录分页
     */
    @Transactional(readOnly = true)
    public PageResult<LotterySimulationVO> list(Long userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        Page<LotterySimulation> result = simulationMapper.selectPage(new Page<>(safePage + 1L, safeSize),
                Wrappers.<LotterySimulation>lambdaQuery()
                        .eq(LotterySimulation::getUserId, userId)
                        .orderByDesc(LotterySimulation::getCreateTime));
        return PageResult.of(result, result.getRecords().stream().map(this::toVo).toList());
    }

    /**
     * 查询单条模拟记录详情。
     *
     * @param userId 用户 ID
     * @param id     模拟 ID
     * @return 模拟详情
     */
    @Transactional(readOnly = true)
    public LotterySimulationVO get(Long userId, Long id) {
        LotterySimulation simulation = simulationMapper.selectById(id);
        if (simulation == null || !simulation.getUserId().equals(userId)) {
            throw new BusinessException(404, "模拟记录不存在");
        }
        return toVo(simulation);
    }

    // ============ 数据加载 ============

    private List<SimulationDraw> loadKl8Draws(int window) {
        List<com.lcbinterview.model.LotteryKl8Draw> draws = kl8DrawMapper.selectList(
                Wrappers.<com.lcbinterview.model.LotteryKl8Draw>lambdaQuery()
                        .orderByDesc(com.lcbinterview.model.LotteryKl8Draw::getIssueNo)
                        .last("LIMIT " + (window + LEAD_HISTORY)));
        return draws.stream()
                .map(draw -> new SimulationDraw(draw.getIssueNo(), draw.getDrawDate(),
                        parseNumbers(draw.getNumbers()), List.of(), draw.getNumbers()))
                .toList();
    }

    private List<SimulationDraw> loadSsqDraws(int window) {
        List<SsqDraw> draws = ssqDrawMapper.selectList(
                Wrappers.<SsqDraw>lambdaQuery()
                        .orderByDesc(SsqDraw::getIssueNo)
                        .last("LIMIT " + (window + LEAD_HISTORY)));
        return draws.stream()
                .map(draw -> new SimulationDraw(draw.getIssueNo(), draw.getDrawDate(),
                        parseNumbers(draw.getRedNumbers()), List.of(parseBlue(draw.getBlueNumber())),
                        draw.getRedNumbers() + "," + draw.getBlueNumber()))
                .toList();
    }

    private List<SimulationDraw> loadDltDraws(int window) {
        List<DltDraw> draws = dltDrawMapper.selectList(
                Wrappers.<DltDraw>lambdaQuery()
                        .orderByDesc(DltDraw::getIssueNo)
                        .last("LIMIT " + (window + LEAD_HISTORY)));
        return draws.stream()
                .map(draw -> new SimulationDraw(draw.getIssueNo(), draw.getDrawDate(),
                        parseNumbers(draw.getFrontNumbers()), parseNumbers(draw.getBackNumbers()),
                        draw.getFrontNumbers() + "," + draw.getBackNumbers()))
                .toList();
    }

    // ============ 模拟算法 ============

    /**
     * 快乐8 模拟：前 50 期为前置历史，逐期用频次+遗漏预测 2 组选4，结算单组最高命中。
     */
    private List<SimulationEntry> simulateKl8(List<SimulationDraw> draws, int window) {
        List<SimulationEntry> entries = new ArrayList<>();
        // 数据降序（最新在前），倒序后升序（最旧在前）便于逐期滚动
        List<SimulationDraw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        // 评估窗口 = 最后 window 期（时间上最新），其之前为前置历史
        int evaluationStart = Math.max(0, ordered.size() - window);
        // 只能使用模拟窗口之前已经开奖的真实数据，不能把待预测期提前放入历史，避免数据泄漏。
        List<List<Integer>> history = new ArrayList<>(ordered.subList(0, evaluationStart).stream()
                .map(SimulationDraw::numbers).toList());
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            SimulationDraw target = ordered.get(index);
            List<Integer> predicted = predictFrequency(recentHistory(history), 8, 80);
            List<Integer> group1 = predicted.subList(0, 4);
            List<Integer> group2 = predicted.subList(4, 8);
            Set<Integer> actual = new LinkedHashSet<>(target.numbers());
            int g1Hit = (int) group1.stream().filter(actual::contains).count();
            int g2Hit = (int) group2.stream().filter(actual::contains).count();
            int primary = Math.max(g1Hit, g2Hit);
            entries.add(new SimulationEntry(target.issueNo(), target.drawDate(),
                    group1, group2, List.of(), primary, g1Hit + g2Hit));
            history.add(target.numbers());
        }
        return entries;
    }

    /**
     * 双色球模拟：7 红 + 1 蓝，逐期用频次+遗漏预测，结算红球命中（主）与蓝球（次）。
     */
    private List<SimulationEntry> simulateSsq(List<SimulationDraw> draws, int window) {
        List<SimulationEntry> entries = new ArrayList<>();
        List<SimulationDraw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        int evaluationStart = Math.max(0, ordered.size() - window);
        List<List<Integer>> redHistory = new ArrayList<>(ordered.subList(0, evaluationStart).stream()
                .map(SimulationDraw::numbers).toList());
        List<List<Integer>> blueHistory = new ArrayList<>(ordered.subList(0, evaluationStart).stream()
                .map(SimulationDraw::backNumbers).toList());
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            SimulationDraw target = ordered.get(index);
            List<Integer> reds = predictFrequency(recentHistory(redHistory), 7, 33);
            int blue = predictMostFrequent(recentHistory(blueHistory), 16);
            Set<Integer> actualReds = new LinkedHashSet<>(target.numbers());
            int redHit = (int) reds.stream().filter(actualReds::contains).count();
            int blueHit = target.backNumbers().contains(blue) ? 1 : 0;
            entries.add(new SimulationEntry(target.issueNo(), target.drawDate(),
                    reds, List.of(blue), List.of(), redHit, blueHit));
            redHistory.add(target.numbers());
            blueHistory.add(target.backNumbers());
        }
        return entries;
    }

    /**
     * 大乐透模拟：5 前区 + 3 后区，逐期用频次+遗漏预测，结算前区命中（主）与后区（次）。
     */
    private List<SimulationEntry> simulateDlt(List<SimulationDraw> draws, int window) {
        List<SimulationEntry> entries = new ArrayList<>();
        List<SimulationDraw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        int evaluationStart = Math.max(0, ordered.size() - window);
        List<List<Integer>> frontHistory = new ArrayList<>(ordered.subList(0, evaluationStart).stream()
                .map(SimulationDraw::numbers).toList());
        List<List<Integer>> backHistory = new ArrayList<>(ordered.subList(0, evaluationStart).stream()
                .map(SimulationDraw::backNumbers).toList());
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            SimulationDraw target = ordered.get(index);
            List<Integer> fronts = predictFrequency(recentHistory(frontHistory), 5, 35);
            List<Integer> backs = predictFrequency(recentHistory(backHistory), 3, 12);
            Set<Integer> actualFronts = new LinkedHashSet<>(target.numbers());
            int frontHit = (int) fronts.stream().filter(actualFronts::contains).count();
            int backHit = (int) backs.stream().filter(target.backNumbers()::contains).count();
            entries.add(new SimulationEntry(target.issueNo(), target.drawDate(),
                    fronts, backs, List.of(), frontHit, backHit));
            frontHistory.add(target.numbers());
            backHistory.add(target.backNumbers());
        }
        return entries;
    }

    // ============ 预测算法（与线上策略同源：频次 + 遗漏回补） ============

    /**
     * 每一步预测严格只使用最近 50 期，保证不同模拟窗口在重叠区间使用完全相同的输入历史。
     */
    private List<List<Integer>> recentHistory(List<List<Integer>> history) {
        int fromIndex = Math.max(0, history.size() - LEAD_HISTORY);
        return history.subList(fromIndex, history.size());
    }

    /**
     * 频次 + 遗漏回补预测：按频次占比 60% + 遗漏压力 40% 综合分排序，取前 size 个。
     *
     * @param history 历史号码序列（升序，最新在后）
     * @param size    预测数量
     * @param max     号码范围上限
     * @return 预测号码（升序）
     */
    private List<Integer> predictFrequency(List<List<Integer>> history, int size, int max) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (List<Integer> draw : history) {
            for (int number : draw) {
                freq.merge(number, 1, Integer::sum);
            }
        }
        int maxFreq = freq.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        List<int[]> scored = new ArrayList<>(); // [number, score*100]
        for (int number = 1; number <= max; number += 1) {
            int f = freq.getOrDefault(number, 0);
            int omission = currentOmission(history, number);
            int score = (int) (f * 60.0 / maxFreq + Math.min(omission, 20) * 40.0 / 20);
            scored.add(new int[]{number, score});
        }
        return scored.stream()
                .sorted(Comparator.comparingInt((int[] item) -> item[1]).reversed()
                        .thenComparing(item -> -item[0]))
                .limit(size)
                .map(item -> item[0])
                .sorted()
                .toList();
    }

    private int predictMostFrequent(List<List<Integer>> history, int max) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (List<Integer> draw : history) {
            for (int number : draw) {
                freq.merge(number, 1, Integer::sum);
            }
        }
        int best = 1;
        int bestScore = -1;
        for (int number = 1; number <= max; number += 1) {
            int score = freq.getOrDefault(number, 0) * 100 + Math.min(currentOmission(history, number), 20);
            if (score > bestScore) {
                bestScore = score;
                best = number;
            }
        }
        return best;
    }

    private int currentOmission(List<List<Integer>> history, int number) {
        int omission = 0;
        for (int index = history.size() - 1; index >= 0; index -= 1) {
            if (history.get(index).contains(number)) {
                break;
            }
            omission += 1;
        }
        return omission;
    }

    // ============ 统计与序列化 ============

    private SimulationStats aggregate(List<SimulationEntry> entries, boolean kl8) {
        if (entries.isEmpty()) {
            return new SimulationStats(0, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, BigDecimal.ZERO, 0, Map.of());
        }
        long totalPrimary = 0;
        long totalSecondary = 0;
        int zeroHit = 0;
        int maxHits = 0;
        int hitAtLeastOne = 0;
        int hit4Count = 0;
        Map<Integer, Integer> distribution = new java.util.TreeMap<>();
        for (SimulationEntry entry : entries) {
            totalPrimary += entry.primaryHits();
            totalSecondary += entry.secondaryHits();
            distribution.merge(entry.primaryHits(), 1, Integer::sum);
            if (kl8) {
                // 快乐8 口径：单组中 2 个及以上才算有效命中，中 1 个不计奖励
                if (entry.primaryHits() >= 2) {
                    hitAtLeastOne += 1;
                } else {
                    zeroHit += 1;
                }
                if (entry.primaryHits() == 4) {
                    hit4Count += 1;
                }
            } else {
                if (entry.primaryHits() == 0 && entry.secondaryHits() == 0) {
                    zeroHit += 1;
                }
                if (entry.primaryHits() > 0 || entry.secondaryHits() > 0) {
                    hitAtLeastOne += 1;
                }
            }
            maxHits = Math.max(maxHits, entry.primaryHits());
        }
        int count = entries.size();
        BigDecimal avgPrimary = BigDecimal.valueOf(totalPrimary)
                .divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        BigDecimal avgSecondary = BigDecimal.valueOf(totalSecondary)
                .divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        BigDecimal rate = BigDecimal.valueOf(hitAtLeastOne * 100)
                .divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        return new SimulationStats((int) totalPrimary, avgPrimary, rate, zeroHit, maxHits, avgSecondary, hit4Count,
                distribution);
    }

    private String writeDistributionJson(Map<Integer, Integer> distribution) {
        try {
            return objectMapper.writeValueAsString(distribution);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String writeResultJson(List<SimulationEntry> entries) {
        ArrayNode array = objectMapper.createArrayNode();
        for (SimulationEntry entry : entries) {
            ObjectNode node = array.addObject();
            node.put("issueNo", entry.issueNo());
            node.put("drawDate", entry.drawDate() == null ? "" : entry.drawDate().toString());
            ArrayNode predicted = node.putArray("predicted");
            entry.predicted().forEach(predicted::add);
            if (!entry.predictedExtra().isEmpty()) {
                ArrayNode extra = node.putArray("predictedExtra");
                entry.predictedExtra().forEach(extra::add);
            }
            node.put("primaryHits", entry.primaryHits());
            node.put("secondaryHits", entry.secondaryHits());
        }
        return array.toString();
    }

    private String buildSummary(String type, int window, SimulationStats stats) {
        String label = switch (type) {
            case "KL8" -> "快乐8 选4×2组";
            case "SSQ" -> "双色球 7+1";
            case "DLT" -> "大乐透 5+3";
            default -> type;
        };
        if ("KL8".equals(type)) {
            return "%s 模拟 %d 期：平均命中 %.2f 个，中 2 个及以上占比 %.1f%%，无有效命中 %d 期，单组全中 4 个 %d 期，单期最高 %d 个"
                    .formatted(label, window, stats.avgHits(), stats.hitRate(), stats.zeroHitCount(),
                            stats.hit4Count(), stats.maxHits());
        }
        return "%s 模拟 %d 期：平均命中 %.2f 个，至少命中 1 个占比 %.1f%%，全不中 %d 期，单期最高 %d 个"
                .formatted(label, window, stats.avgHits(), stats.hitRate(), stats.zeroHitCount(), stats.maxHits());
    }

    private LotterySimulationVO toVo(LotterySimulation entity) {
        return new LotterySimulationVO(
                entity.getId(),
                entity.getLotteryType(),
                entity.getWindowSize(),
                entity.getLeadHistory(),
                entity.getStartIssueNo(),
                entity.getEndIssueNo(),
                entity.getEvaluatedCount(),
                entity.getTotalHits(),
                entity.getAvgHits(),
                entity.getHitRate(),
                entity.getZeroHitCount(),
                entity.getMaxHits(),
                entity.getSecondaryAvg(),
                entity.getHit4Count(),
                entity.getHitDistributionJson(),
                entity.getSummary(),
                entity.getCreateTime());
    }

    private List<Integer> parseNumbers(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<Integer> numbers = new ArrayList<>();
        for (String part : value.split("[,，\\s]+")) {
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
            return value == null ? 0 : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 模拟用开奖数据（统一结构）。
     *
     * @param issueNo    期号
     * @param drawDate   开奖日期
     * @param numbers    主号码（KL8 20 个/SSQ 红球/DLT 前区）
     * @param backNumbers 次号码（KL8 空/SSQ 蓝球 1 个/DLT 后区 2 个）
     * @param rawNumbers 原始号码文本
     */
    private record SimulationDraw(String issueNo, java.time.LocalDate drawDate,
                                  List<Integer> numbers, List<Integer> backNumbers, String rawNumbers) {
    }

    /**
     * 单期模拟明细。
     *
     * @param issueNo       期号
     * @param drawDate      开奖日期
     * @param predicted     预测主号码
     * @param predictedExtra 预测次号码（KL8 第二组）
     * @param extraExtra    预留
     * @param primaryHits   主维度命中
     * @param secondaryHits 次维度命中
     */
    private record SimulationEntry(String issueNo, java.time.LocalDate drawDate,
                                   List<Integer> predicted, List<Integer> predictedExtra,
                                   List<Integer> extraExtra,
                                   int primaryHits, int secondaryHits) {
    }

    /**
     * 模拟统计结果。
     *
     * @param distribution 主维度命中数分布（0-N 各多少期）
     */
    private record SimulationStats(int totalHits, BigDecimal avgHits, BigDecimal hitRate,
                                   int zeroHitCount, int maxHits, BigDecimal secondaryAvg,
                                   int hit4Count, Map<Integer, Integer> distribution) {
    }
}
