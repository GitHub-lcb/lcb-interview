package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.tools.LotteryKl8LabPortfolioRowVO;
import com.lcbinterview.dto.tools.LotteryKl8LabReportVO;
import com.lcbinterview.dto.tools.LotteryKl8LabRequest;
import com.lcbinterview.dto.tools.LotteryKl8LabVariantVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 快乐8 概率实验室服务：把「模拟战场」从单次回放升级为可验证的概率实验台。
 * <p>
 * 它回答两个问题：
 * 1. 某个选号配置的走查前推表现，是否真的超出理论基线？——用 Wilson 区间和 z 值判定，
 *    并给出「确认 +1 个百分点提升需要多少期样本」，避免把噪声当成优势。
 * 2. 多注投注能不能提升概率？——单注概率由超几何分布锁死，但「至少中一注」的概率
 *    可以通过多注号码不重复来真实提升，这里用同一段历史同时回放「不重复拆分」和「重复同一注」。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8LabService {

    /** 与线上每日推荐一致的选4 口径 */
    private static final int PICK_SIZE = 4;
    /** 选4 的首个有奖级别：中 2 个（官方规则选四中二即中奖 3 元） */
    private static final int MIN_HIT_LEVEL = 2;
    /** 与每日推荐一致的输入窗口 */
    private static final int LEAD_HISTORY = 100;
    private static final int MIN_WINDOW = 10;
    private static final int MAX_WINDOW = 300;
    private static final int DEFAULT_WINDOW = 100;
    private static final int DEFAULT_MAX_TICKETS = 3;
    /**
     * 最大注数取 80 / 4 = 20，即互不重复时能覆盖全部号码的上限。
     * 超过 20 注必然出现重号，而重号只会拉低「至少中一注」的概率。
     */
    private static final int MAX_TICKETS = 20;
    /** 用于估算样本量的提升量：1 个百分点 */
    private static final double ONE_POINT_LIFT = 0.01;
    private static final String DISCLAIMER = "彩票结果具有随机性，本实验室只做统计检验，不构成投注建议。";

    private final LotteryKl8DrawMapper drawMapper;
    private final LotteryKl8FeatureService featureService;
    private final LotteryKl8StrategyCalibrationService calibrationService;

    /**
     * 运行概率实验室：权重寻优 + 投注组合实验。
     *
     * @param userId  用户 ID，用于读取个性化校准与命中反馈
     * @param request 实验参数
     * @return 实验室报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8LabReportVO run(Long userId, LotteryKl8LabRequest request) {
        int baseIssueCount = request.baseIssueCount() == null ? 2000 : request.baseIssueCount();
        int windowSize = request.windowSize() == null ? DEFAULT_WINDOW : request.windowSize();
        int maxTicketCount = request.maxTicketCount() == null ? DEFAULT_MAX_TICKETS : request.maxTicketCount();
        int window = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, windowSize));
        int maxTickets = Math.max(1, Math.min(MAX_TICKETS, maxTicketCount));

        double baselineAtLeastThree = LotteryKl8Statistics.atLeastHitProbability(PICK_SIZE, MIN_HIT_LEVEL);
        double baselineAtLeastFour = LotteryKl8Statistics.atLeastHitProbability(PICK_SIZE, 4);
        double baselineFullHit = LotteryKl8Statistics.exactHitProbability(PICK_SIZE, PICK_SIZE);

        List<LotteryKl8LabVariantVO> variants = sweepVariants(baseIssueCount, baselineAtLeastThree);
        List<LotteryKl8LabPortfolioRowVO> portfolios = runPortfolio(userId, window, maxTickets);
        int evaluated = variants.isEmpty() ? 0 : variants.getFirst().evaluatedIssueCount();

        return new LotteryKl8LabReportVO(
                PICK_SIZE,
                baseIssueCount,
                window,
                evaluated,
                LotteryKl8Statistics.expectedHits(PICK_SIZE),
                baselineAtLeastThree,
                baselineAtLeastFour,
                baselineFullHit,
                LotteryKl8Statistics.requiredSampleSize(baselineAtLeastThree, ONE_POINT_LIFT),
                variants,
                portfolios,
                buildConclusion(variants, portfolios, baselineAtLeastThree),
                DISCLAIMER);
    }

    /**
     * 权重寻优：把走查前推回测里各候选配置的表现转成带置信区间和显著性判定的结果。
     *
     * @param baseIssueCount       历史期数
     * @param baselineAtLeastThree 理论中 2 个及以上概率（字段名沿用历史命名，语义为选4首个有奖级别）
     * @return 各配置的对比结果，按中 2 个及以上占比降序
     */
    private List<LotteryKl8LabVariantVO> sweepVariants(int baseIssueCount, double baselineAtLeastThree) {
        LotteryKl8FeatureReport report = featureService.buildReport(baseIssueCount);
        List<LotteryKl8ProfileBacktest> profiles = report.backtestSummary().profileBacktests();
        List<LotteryKl8LabVariantVO> variants = new ArrayList<>();
        for (LotteryKl8ProfileBacktest profile : profiles) {
            int trials = profile.evaluatedIssueCount();
            int successes = countAtLeast(profile.hitDistribution(), MIN_HIT_LEVEL);
            double rate = trials == 0 ? 0 : (double) successes / trials;
            double[] interval = LotteryKl8Statistics.wilsonInterval(successes, trials);
            double lift = rate - baselineAtLeastThree;
            double zScore = LotteryKl8Statistics.zScore(successes, trials, baselineAtLeastThree);
            boolean aboveSignificant = interval[0] > baselineAtLeastThree;
            boolean belowSignificant = interval[1] < baselineAtLeastThree;
            variants.add(new LotteryKl8LabVariantVO(
                    profile.name(),
                    profile.label(),
                    profile.selected(),
                    trials,
                    profile.averageHitCount(),
                    round(rate),
                    round(interval[0]),
                    round(interval[1]),
                    round(lift),
                    round(zScore),
                    aboveSignificant || belowSignificant,
                    verdict(aboveSignificant, belowSignificant),
                    profile.hitDistribution()));
        }
        return variants.stream()
                .sorted(Comparator.comparingDouble(LotteryKl8LabVariantVO::atLeastThreeRate).reversed()
                        .thenComparing(LotteryKl8LabVariantVO::label))
                .toList();
    }

    /**
     * 投注组合实验：逐期回放「不重复拆分 N 注」与「重复同一注 N 次」的至少中一注概率。
     *
     * @param userId     用户 ID
     * @param window     回放期数
     * @param maxTickets 最大注数
     * @return 每期 1 到 N 注的对比结果
     */
    private List<LotteryKl8LabPortfolioRowVO> runPortfolio(Long userId, int window, int maxTickets) {
        List<LotteryKl8Draw> draws = drawMapper.selectList(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT " + (window + LEAD_HISTORY)));
        if (draws.size() < 20) {
            throw new BusinessException(400, "历史开奖数据不足 20 期，请先同步开奖数据");
        }
        List<LotteryKl8Draw> ordered = new ArrayList<>(draws);
        java.util.Collections.reverse(ordered);
        int evaluationStart = Math.max(0, ordered.size() - window);
        List<LotteryKl8Draw> history = new ArrayList<>(ordered.subList(0, evaluationStart));
        LotteryKl8StrategyCalibration calibration = calibrationService.currentCalibration(userId);
        Map<Integer, Double> numberHitFeedback = calibrationService.numberHitFeedback(userId);

        int[] disjointSuccess = new int[maxTickets + 1];
        int[] repeatedSuccess = new int[maxTickets + 1];
        int evaluated = 0;
        // 逐期取最小可用注数：号码池不足时多出的行概率恒为 0，会被误读成「加注反而更差」
        int ticketCapacity = maxTickets;
        for (int index = evaluationStart; index < ordered.size(); index += 1) {
            LotteryKl8Draw target = ordered.get(index);
            // 特征服务要求至少 20 期历史：样本不足的前几期直接跳过，避免整次实验因早期数据不足而失败
            if (history.size() < 20) {
                history.add(target);
                continue;
            }
            LotteryKl8FeatureReport report = featureService.buildReportFromDraws(
                    recentDrawsDescending(history), calibration, PICK_SIZE, numberHitFeedback);
            List<List<Integer>> tickets = buildTickets(report, maxTickets);
            ticketCapacity = Math.min(ticketCapacity, tickets.size());
            Set<Integer> actual = new LinkedHashSet<>(featureService.parseNumbers(target.getNumbers()));
            int firstHit = tickets.isEmpty() ? 0 : hitCount(tickets.getFirst(), actual);
            for (int ticketCount = 1; ticketCount <= tickets.size(); ticketCount += 1) {
                // 不重复拆分：前 N 注里任意一注中 2 个及以上即算达成（选4首个有奖级别）
                int bestDisjoint = 0;
                for (int ticketIndex = 0; ticketIndex < ticketCount; ticketIndex += 1) {
                    bestDisjoint = Math.max(bestDisjoint, hitCount(tickets.get(ticketIndex), actual));
                }
                if (bestDisjoint >= MIN_HIT_LEVEL) {
                    disjointSuccess[ticketCount] += 1;
                }
                // 重复同一注：买 N 次同一注，至少中一注的概率与单注完全相同
                if (firstHit >= MIN_HIT_LEVEL) {
                    repeatedSuccess[ticketCount] += 1;
                }
            }
            evaluated += 1;
            history.add(target);
        }

        List<LotteryKl8LabPortfolioRowVO> rows = new ArrayList<>();
        if (evaluated == 0) {
            // 没有可结算的期数时所有比率都是 0，直接返回空行而不是伪造一整表 0%
            log.warn("投注组合实验无可结算期数: 请求回放 {} 期，历史 {} 期", window, ordered.size());
            return rows;
        }
        double singleRate = (double) disjointSuccess[1] / evaluated;
        // 只输出实际构造出的注数：号码池不足时多出的行概率恒为 0，会被误读成「加注反而更差」
        for (int ticketCount = 1; ticketCount <= ticketCapacity; ticketCount += 1) {
            double disjointRate = (double) disjointSuccess[ticketCount] / evaluated;
            double repeatedRate = (double) repeatedSuccess[ticketCount] / evaluated;
            double[] interval = LotteryKl8Statistics.wilsonInterval(disjointSuccess[ticketCount], evaluated);
            rows.add(new LotteryKl8LabPortfolioRowVO(
                    ticketCount,
                    round(disjointRate),
                    round(interval[0]),
                    round(interval[1]),
                    round(repeatedRate),
                    round(disjointRate - repeatedRate),
                    round(disjointRate - singleRate),
                    evaluated));
        }
        return rows;
    }

    /**
     * 构造每期实际投注的号码组合：第 1 注用当日生产推荐，其余注从候选排名里取不重复号码。
     *
     * @param report     当期特征报告
     * @param maxTickets 最大注数
     * @return 号码组合列表，长度不超过 maxTickets
     */
    private List<List<Integer>> buildTickets(LotteryKl8FeatureReport report, int maxTickets) {
        List<List<Integer>> tickets = new ArrayList<>();
        List<Integer> production = report.optimizedPortfolio().groups().isEmpty()
                ? List.of()
                : report.optimizedPortfolio().groups().getFirst().numbers();
        if (production.size() != PICK_SIZE) {
            // 旧记录口径不一致时退化为纯排名拆分，保证实验仍可运行
            production = List.of();
        }
        if (!production.isEmpty()) {
            tickets.add(production);
        }
        // lambda 只能捕获实际上的最终变量，这里固定一份用于过滤
        final List<Integer> productionNumbers = production;
        List<Integer> ranked = report.numberProfiles().stream()
                .sorted(Comparator.comparingDouble(LotteryKl8NumberProfile::compositeScore).reversed()
                        .thenComparing(LotteryKl8NumberProfile::number))
                .map(LotteryKl8NumberProfile::number)
                .filter(number -> !productionNumbers.contains(number))
                .toList();
        for (int start = 0; tickets.size() < maxTickets && start + PICK_SIZE <= ranked.size(); start += PICK_SIZE) {
            tickets.add(ranked.subList(start, start + PICK_SIZE));
        }
        if (tickets.size() < maxTickets) {
            // 号码池不足时不能按 maxTickets 出行：多出来的行概率恒为 0，会被误读成「买了反而更差」
            log.warn("投注组合实验注数不足: 期望 {} 注，实际可用 {} 注（候选号码池已耗尽）", maxTickets, tickets.size());
        }
        return tickets;
    }

    /**
     * 取历史最近 100 期并转换为特征服务要求的倒序输入。
     *
     * @param history 按时间正序的历史开奖
     * @return 最近 100 期、最新在前
     */
    private <T> List<T> recentDrawsDescending(List<T> history) {
        int fromIndex = Math.max(0, history.size() - LEAD_HISTORY);
        List<T> recent = new ArrayList<>(history.subList(fromIndex, history.size()));
        java.util.Collections.reverse(recent);
        return recent;
    }

    private int countAtLeast(Map<Integer, Integer> distribution, int minHits) {
        int total = 0;
        for (Map.Entry<Integer, Integer> entry : distribution.entrySet()) {
            if (entry.getKey() != null && entry.getKey() >= minHits) {
                total += entry.getValue() == null ? 0 : entry.getValue();
            }
        }
        return total;
    }

    private int hitCount(List<Integer> ticket, Set<Integer> actual) {
        int hits = 0;
        for (Integer number : ticket) {
            if (actual.contains(number)) {
                hits += 1;
            }
        }
        return hits;
    }

    private String verdict(boolean aboveSignificant, boolean belowSignificant) {
        if (aboveSignificant) {
            return "显著高于基线";
        }
        if (belowSignificant) {
            return "显著低于基线";
        }
        return "与基线无显著差异";
    }

    /**
     * 生成结论文案：明确指出单注概率是数学常量，并给出本次实验的有效结论。
     *
     * @param variants             权重寻优结果
     * @param portfolios           投注组合结果
     * @param baselineAtLeastThree 理论中 2 个及以上概率（字段名沿用历史命名）
     * @return 结论
     */
    private String buildConclusion(
            List<LotteryKl8LabVariantVO> variants,
            List<LotteryKl8LabPortfolioRowVO> portfolios,
            double baselineAtLeastThree) {
        long significantCount = variants.stream().filter(LotteryKl8LabVariantVO::significant).count();
        LotteryKl8LabVariantVO best = variants.stream()
                .max(Comparator.comparingDouble(LotteryKl8LabVariantVO::atLeastThreeRate))
                .orElse(null);
        String variantText = variants.isEmpty()
            ? "本次样本不足，未生成配置对比。"
            : "本次对比了 %d 个选号配置，其中 %d 个与基线存在显著差异；表现最好的配置是「%s」，中 2 个及以上 %.2f%%（95%% 区间 %.2f%%~%.2f%%），相对基线 %+.2f 个百分点。"
                .formatted(variants.size(), significantCount, best.label(),
                        best.atLeastThreeRate() * 100, best.ciLow() * 100, best.ciHigh() * 100,
                        best.lift() * 100);
        LotteryKl8LabPortfolioRowVO lastRow = portfolios.isEmpty() ? null : portfolios.getLast();
        String portfolioText = lastRow == null
            ? "投注组合实验样本不足。"
            : "每期买 %d 注且号码不重复，至少中一注的概率实测 %.2f%%（重复买同一注 %.2f%%），提升 %+.2f 个百分点——这是唯一能真正提高概率的方向，代价是投注成本同比增加。"
                .formatted(lastRow.ticketCount(), lastRow.disjointRate() * 100,
                        lastRow.repeatedRate() * 100, lastRow.liftOverRepeated() * 100);
        return "单注「中 2 个及以上」的理论概率固定为 %.2f%%（超几何分布），任何选号策略都无法改变它。%s %s"
                .formatted(baselineAtLeastThree * 100, variantText, portfolioText);
    }

    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
