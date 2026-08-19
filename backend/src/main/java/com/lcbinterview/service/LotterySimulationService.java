package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import com.lcbinterview.dto.tools.LotterySimulationVO;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.LotterySimulationMapper;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.DltDraw;
import com.lcbinterview.model.LotteryKl8Draw;
import com.lcbinterview.model.LotterySimulation;
import com.lcbinterview.model.SsqDraw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 彩票模拟战场服务：选择最近 N 期（10-1000），假设全部未开，
 * 逐期调用与每日推荐相同的 FeatureService/Policy 预测并结算，最终统计命中表现。
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

    /** 每日自动推荐默认使用最近 100 期，模拟必须保持同一输入窗口。 */
    private static final int LEAD_HISTORY = 100;
    private static final int KL8_PICK_SIZE = 4;
    private static final int MIN_WINDOW = 10;
    private static final int MAX_WINDOW = 1000;

    private final LotteryKl8DrawMapper kl8DrawMapper;
    private final SsqDrawMapper ssqDrawMapper;
    private final DltDrawMapper dltDrawMapper;
    private final LotterySimulationMapper simulationMapper;
    private final ObjectMapper objectMapper;
    private final LotteryKl8FeatureService kl8FeatureService;
    private final LotteryKl8RecommendationPolicy kl8RecommendationPolicy;
    private final LotteryKl8StrategyCalibrationService kl8CalibrationService;
    private final SsqFeatureService ssqFeatureService;
    private final DltFeatureService dltFeatureService;

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
                List<LotteryKl8Draw> draws = loadKl8Draws(window);
                entries = simulateKl8(userId, draws, window);
                stats = aggregate(entries, true);
            }
            case "SSQ" -> {
                List<SsqDraw> draws = loadSsqDraws(window);
                entries = simulateSsq(draws, window);
                stats = aggregate(entries, false);
            }
            case "DLT" -> {
                List<DltDraw> draws = loadDltDraws(window);
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

    private List<LotteryKl8Draw> loadKl8Draws(int window) {
        return kl8DrawMapper.selectList(
                Wrappers.<LotteryKl8Draw>lambdaQuery()
                        .orderByDesc(LotteryKl8Draw::getIssueNo)
                        .last("LIMIT " + (window + LEAD_HISTORY)));
    }

    private List<SsqDraw> loadSsqDraws(int window) {
        return ssqDrawMapper.selectList(
                Wrappers.<SsqDraw>lambdaQuery()
                        .orderByDesc(SsqDraw::getIssueNo)
                        .last("LIMIT " + (window + LEAD_HISTORY)));
    }

    private List<DltDraw> loadDltDraws(int window) {
        return dltDrawMapper.selectList(
                Wrappers.<DltDraw>lambdaQuery()
                        .orderByDesc(DltDraw::getIssueNo)
                        .last("LIMIT " + (window + LEAD_HISTORY)));
    }

    // ============ 模拟算法 ============

    /**
     * 快乐8 模拟：逐期调用 V20 每日正式策略（四策略投票、邻位、覆盖去重、用户校准）。
     */
    private List<SimulationEntry> simulateKl8(Long userId, List<LotteryKl8Draw> draws, int window) {
        List<SimulationEntry> entries = new ArrayList<>();
        List<LotteryKl8Draw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        int evaluationStart = Math.max(0, ordered.size() - window);
        List<LotteryKl8Draw> history = new ArrayList<>(ordered.subList(0, evaluationStart));
        LotteryKl8StrategyCalibration calibration = kl8CalibrationService.currentCalibration(userId);
        Map<Integer, Double> numberHitFeedback = kl8CalibrationService.numberHitFeedback(userId);
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            LotteryKl8Draw target = ordered.get(index);
            LotteryKl8FeatureReport report = kl8FeatureService.buildReportFromDraws(
                    recentDrawsDescending(history), calibration, KL8_PICK_SIZE, numberHitFeedback);
            List<LotteryKl8RecommendationGroupVO> groups = kl8RecommendationPolicy
                    .fallbackResult(report, KL8_PICK_SIZE).groups();
            List<Integer> group1 = groups.get(0).numbers();
            List<Integer> group2 = groups.get(1).numbers();
            Set<Integer> actual = new LinkedHashSet<>(kl8FeatureService.parseNumbers(target.getNumbers()));
            int g1Hit = (int) group1.stream().filter(actual::contains).count();
            int g2Hit = (int) group2.stream().filter(actual::contains).count();
            int primary = Math.max(g1Hit, g2Hit);
            // KL8 不按奖级统计，奖级固定为 0，命中口径由单组命中数决定
            entries.add(new SimulationEntry(target.getIssueNo(), target.getDrawDate(),
                    group1, group2, List.of(), primary, g1Hit + g2Hit, 0));
            history.add(target);
        }
        return entries;
    }

    /**
     * 双色球模拟：逐期调用每日正式策略（频次、遗漏、邻位、区间均衡、蓝球频次遗漏）。
     */
    private List<SimulationEntry> simulateSsq(List<SsqDraw> draws, int window) {
        List<SimulationEntry> entries = new ArrayList<>();
        List<SsqDraw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        int evaluationStart = Math.max(0, ordered.size() - window);
        List<SsqDraw> history = new ArrayList<>(ordered.subList(0, evaluationStart));
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            SsqDraw target = ordered.get(index);
            SsqFeatureService.SsqPicks picks = ssqFeatureService.generatePicksFromDraws(
                    recentDrawsDescending(history), LEAD_HISTORY);
            List<Integer> reds = picks.redPicks();
            int blue = picks.bluePick();
            Set<Integer> actualReds = new LinkedHashSet<>(parseNumbers(target.getRedNumbers()));
            int redHit = (int) reds.stream().filter(actualReds::contains).count();
            int blueHit = parseBlue(target.getBlueNumber()) == blue ? 1 : 0;
            // 双色球中奖口径：按官方奖级判定（蓝球 alone 即中六等奖，红球≥4 或蓝球命中即中奖）
            int prizeTier = ssqPrizeTier(redHit, blueHit);
            entries.add(new SimulationEntry(target.getIssueNo(), target.getDrawDate(),
                    reds, List.of(blue), List.of(), redHit, blueHit, prizeTier));
            history.add(target);
        }
        return entries;
    }

    /**
     * 大乐透模拟：逐期调用每日正式策略（前区频次/遗漏/邻位/均衡，后区频次/遗漏）。
     */
    private List<SimulationEntry> simulateDlt(List<DltDraw> draws, int window) {
        List<SimulationEntry> entries = new ArrayList<>();
        List<DltDraw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        int evaluationStart = Math.max(0, ordered.size() - window);
        List<DltDraw> history = new ArrayList<>(ordered.subList(0, evaluationStart));
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            DltDraw target = ordered.get(index);
            DltFeatureService.DltPicks picks = dltFeatureService.generatePicksFromDraws(
                    recentDrawsDescending(history), LEAD_HISTORY);
            List<Integer> fronts = picks.frontPicks();
            List<Integer> backs = picks.backPicks();
            Set<Integer> actualFronts = new LinkedHashSet<>(parseNumbers(target.getFrontNumbers()));
            int frontHit = (int) fronts.stream().filter(actualFronts::contains).count();
            List<Integer> actualBacks = parseNumbers(target.getBackNumbers());
            int backHit = (int) backs.stream().filter(actualBacks::contains).count();
            // 大乐透中奖口径：后区全中（2 个）或前区≥5、或前区4/3且后区有命中即中奖
            int prizeTier = dltPrizeTier(frontHit, backHit);
            entries.add(new SimulationEntry(target.getIssueNo(), target.getDrawDate(),
                    fronts, backs, List.of(), frontHit, backHit, prizeTier));
            history.add(target);
        }
        return entries;
    }

    // ============ 预测算法输入窗口 ============

    /**
     * 每一步预测严格只使用每日推荐默认的最近 100 期，并转换为 FeatureService 要求的倒序。
     */
    private <T> List<T> recentDrawsDescending(List<T> history) {
        int fromIndex = Math.max(0, history.size() - LEAD_HISTORY);
        List<T> recent = new ArrayList<>(history.subList(fromIndex, history.size()));
        java.util.Collections.reverse(recent);
        return recent;
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
            // KL8 按单组命中数分布；SSQ/DLT 按中奖奖级分布（0=未中奖）
            distribution.merge(kl8 ? entry.primaryHits() : entry.prizeTier(), 1, Integer::sum);
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
                // 中奖口径：中任何奖级（奖级>0）即算中奖，否则未中奖
                if (entry.prizeTier() > 0) {
                    hitAtLeastOne += 1;
                } else {
                    zeroHit += 1;
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
        // SSQ/DLT 改用中奖口径：中奖率=中任何奖级的比例，并列出主要奖级分布
        String primaryName = "SSQ".equals(type) ? "红" : "前区";
        return "%s 模拟 %d 期：中奖率 %.1f%%（中任何奖级），未中奖 %d 期，单期最高中 %d 个%s，奖级分布：%s"
                .formatted(label, window, stats.hitRate(), stats.zeroHitCount(),
                        stats.maxHits(), primaryName, prizeBreakdown(type, stats.distribution()));
    }

    /**
     * 把奖级分布（奖级 rank → 期数）转成可读文本，仅展示中奖的奖级。
     *
     * @param type       玩法类型，决定奖级名称
     * @param distribution 奖级 rank → 期数
     * @return 形如「六等奖3期、五等奖1期」的文本，无中奖时返回「无」
     */
    private String prizeBreakdown(String type, Map<Integer, Integer> distribution) {
        Map<Integer, String> names = "SSQ".equals(type) ? SSQ_TIER_NAMES : DLT_TIER_NAMES;
        List<String> parts = new java.util.ArrayList<>();
        for (Map.Entry<Integer, Integer> entry : distribution.entrySet()) {
            if (entry.getKey() <= 0 || entry.getValue() <= 0) {
                continue;
            }
            String name = names.get(entry.getKey());
            if (name != null) {
                parts.add(name + entry.getValue() + "期");
            }
        }
        return parts.isEmpty() ? "无" : String.join("、", parts);
    }

    /** 双色球奖级名称：1六 2五 3四 4三 5二 6一 */
    private static final Map<Integer, String> SSQ_TIER_NAMES = java.util.Map.of(
            1, "六等奖", 2, "五等奖", 3, "四等奖", 4, "三等奖", 5, "二等奖", 6, "一等奖");

    /** 大乐透奖级名称：1七 2六 3五 4四 5三 6二 7一 */
    private static final Map<Integer, String> DLT_TIER_NAMES = java.util.Map.of(
            1, "七等奖", 2, "六等奖", 3, "五等奖", 4, "四等奖", 5, "三等奖", 6, "二等奖", 7, "一等奖");

    /**
     * 双色球官方奖级判定（基于红球命中数 redHit 与蓝球命中 blueHit）。
     * 蓝 alone 即中六等奖；红球≥4 或蓝球命中即至少中五/六等奖。
     *
     * @return 奖级 rank：0未中奖 1六 2五 3四 4三 5二 6一
     */
    private int ssqPrizeTier(int redHit, int blueHit) {
        if (redHit == 6) {
            return blueHit == 1 ? 6 : 5;
        }
        if (redHit == 5) {
            return blueHit == 1 ? 4 : 3;
        }
        if (redHit == 4) {
            return blueHit == 1 ? 3 : 2;
        }
        if (redHit == 3) {
            return blueHit == 1 ? 2 : 0;
        }
        return blueHit == 1 ? 1 : 0;
    }

    /**
     * 大乐透官方奖级判定（基于前区命中 frontHit 与后区命中 backHit）。
     * 后区全中（2 个）即至少七等奖；前区 5 必中；前区 4/3 需后区有命中才中奖。
     *
     * @return 奖级 rank：0未中奖 1七 2六 3五 4四 5三 6二 7一
     */
    private int dltPrizeTier(int frontHit, int backHit) {
        if (frontHit == 5) {
            return backHit == 2 ? 7 : backHit == 1 ? 6 : 5;
        }
        if (frontHit == 4) {
            return backHit == 2 ? 4 : backHit == 1 ? 3 : 0;
        }
        if (frontHit == 3) {
            return backHit == 2 ? 2 : backHit == 1 ? 1 : 0;
        }
        return backHit == 2 ? 1 : 0;
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
                entity.getResultJson(),
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
     * 单期模拟明细。
     *
     * @param issueNo       期号
     * @param drawDate      开奖日期
     * @param predicted     预测主号码
     * @param predictedExtra 预测次号码（KL8 第二组 / SSQ 蓝球 / DLT 后区）
     * @param extraExtra    预留
     * @param primaryHits   主维度命中（SSQ 红球 / DLT 前区 / KL8 单组最高）
     * @param secondaryHits 次维度命中（SSQ 蓝球 / DLT 后区）
     * @param prizeTier     中奖奖级（0=未中奖；SSQ 1六~6一；DLT 1七~7一；KL8 恒为 0）
     */
    private record SimulationEntry(String issueNo, java.time.LocalDate drawDate,
                                   List<Integer> predicted, List<Integer> predictedExtra,
                                   List<Integer> extraExtra,
                                   int primaryHits, int secondaryHits, int prizeTier) {
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
