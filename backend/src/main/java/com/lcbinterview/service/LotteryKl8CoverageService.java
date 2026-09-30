package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8CoverageCurveRowVO;
import com.lcbinterview.dto.tools.LotteryKl8CoverageReportVO;
import com.lcbinterview.dto.tools.LotteryKl8CoverageTargetRowVO;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 快乐8 覆盖优化服务：把「花多少钱能买到多少中奖概率」变成精确可查的曲线。
 * <p>
 * <b>为什么这是唯一有效的方向</b>：快乐8 每期从 80 个号里开出 20 个，
 * 单注命中数服从超几何分布，「中 2 个及以上」的概率恒为 25.89%，
 * 这是数学常量，任何选号策略都改不了（期望检验见
 * {@code docs/superpowers/specs/2026-09-20-kl8-probability-levers.md}）。
 * 真正能变的只有「至少中一注」的概率，而它<b>只取决于覆盖了多少个互不重复的号码</b>：
 * 2 注完全互不重复是 45.78%，有 1 个重号就掉到 42.32%。
 * 所以「在预算内买尽可能多互不重复的号」就是理论最优解——这不是预测，是组合数学。
 * <p>
 * <b>本服务不预测任何号码</b>，只做概率与成本的换算。所有概率由
 * {@link LotteryKl8Statistics#atLeastOneTicketProbability} 精确计算，无模拟误差。
 * <p>
 * <b>必须同时说清的另一面</b>：返奖率与注数无关，恒定在 57% 左右。
 * 加注只改变「中奖这件事发生的频率」，不改变「长期平均亏 43%」这个事实。
 * 只报概率不报返奖率是不诚实的，因此 {@link LotteryKl8CoverageReportVO}
 * 每行都带 expectedReturnYuan 与 payoutRate。
 */
@Service
public class LotteryKl8CoverageService {

    /** 快乐8 选4 单注票价（元），与官方玩法一致 */
    private static final double TICKET_PRICE_YUAN = 2.0;

    /**
     * 快乐8 选4 奖金表（元）：索引即命中个数，0 表示未中奖。
     * 取自中国福利彩票官网快乐8 奖金对照表（选四玩法）。
     */
    private static final double[] PICK4_PRIZES = {0, 0, 3, 5, 93};

    /** 默认达标口径：选4 首个有奖级别为「中 2 个」 */
    private static final int DEFAULT_MIN_HIT_LEVEL = 2;

    /** 默认选号数量，与线上每日推荐一致 */
    private static final int DEFAULT_PICK_SIZE = 4;

    /** 曲线默认最大注数：80 / 4 = 20 注即覆盖全部号码 */
    private static final int DEFAULT_MAX_TICKETS = 20;

    /** 概率反查的目标档位，覆盖从「很容易」到「几乎必中」 */
    private static final double[] TARGET_RATES = {0.30, 0.50, 0.80, 0.90, 0.95, 0.99};

    private static final String DISCLAIMER =
            "彩票结果具有随机性。本页所有概率均为组合数学精确解，不构成投注建议；加注只提高中奖频率，不改变长期亏损。";

    /**
     * 生成覆盖优化报告。
     *
     * @param pickSize    每注选号数量，超范围时回退默认
     * @param minHitLevel 达标口径（至少命中几个），超范围时回退默认
     * @param maxTickets  曲线最大注数，超范围时钳制到号码池上限
     * @param budgetYuan  预算上限（元），小于等于 0 表示不做预算分析
     * @return 覆盖优化报告
     */
    public LotteryKl8CoverageReportVO report(int pickSize, int minHitLevel, int maxTickets, double budgetYuan) {
        int effectivePickSize = pickSize > 0 ? pickSize : DEFAULT_PICK_SIZE;
        int effectiveMinHitLevel = minHitLevel > 0 ? minHitLevel : DEFAULT_MIN_HIT_LEVEL;
        int maxDisjoint = LotteryKl8Statistics.maxDisjointTickets(effectivePickSize);
        int effectiveMaxTickets = maxTickets > 0 ? Math.min(maxTickets, maxDisjoint) : DEFAULT_MAX_TICKETS;
        effectiveMaxTickets = Math.max(1, effectiveMaxTickets);

        double singleRate = LotteryKl8Statistics.atLeastOneTicketProbability(
                1, effectivePickSize, effectiveMinHitLevel);
        double expectedPerTicket = expectedReturnPerTicket(effectivePickSize);
        double payoutRate = expectedPerTicket / TICKET_PRICE_YUAN;

        List<LotteryKl8CoverageCurveRowVO> curve = buildCurve(
                effectivePickSize, effectiveMinHitLevel, effectiveMaxTickets, expectedPerTicket, payoutRate);
        List<LotteryKl8CoverageTargetRowVO> targets = buildTargets(effectivePickSize, effectiveMinHitLevel);

        LotteryKl8CoverageCurveRowVO bestValue = curve.stream()
                .filter(row -> row.costPerPercentPoint() > 0)
                .min((left, right) -> Double.compare(left.costPerPercentPoint(), right.costPerPercentPoint()))
                .orElse(curve.getFirst());

        int budgetTicketCount = 0;
        double budgetAchievableRate = 0;
        if (budgetYuan > 0) {
            budgetTicketCount = Math.min((int) Math.floor(budgetYuan / TICKET_PRICE_YUAN), maxDisjoint);
            budgetAchievableRate = LotteryKl8Statistics.atLeastOneTicketProbability(
                    budgetTicketCount, effectivePickSize, effectiveMinHitLevel);
        }

        return new LotteryKl8CoverageReportVO(
                effectivePickSize,
                effectiveMinHitLevel,
                TICKET_PRICE_YUAN,
                maxDisjoint,
                roundProbability(singleRate),
                round(expectedPerTicket),
                roundProbability(payoutRate),
                round(TICKET_PRICE_YUAN - expectedPerTicket),
                curve,
                targets,
                bestValue.ticketCount(),
                round(bestValue.costPerPercentPoint()),
                round(budgetYuan),
                budgetTicketCount,
                roundProbability(budgetAchievableRate),
                buildConclusion(effectiveMinHitLevel, singleRate, targets,
                        payoutRate, expectedPerTicket, maxDisjoint, bestValue, budgetYuan, budgetTicketCount,
                        budgetAchievableRate),
                DISCLAIMER);
    }

    /**
     * 单注期望回报：各命中档概率乘以对应奖金之和。
     * <p>
     * 由期望的线性性，N 注的期望回报恒为 N 倍单注期望回报——各注之间虽然相关，
     * 但期望可加。因此返奖率与注数无关，这是「加注不改变长期亏损」的严格依据。
     *
     * @param pickSize 每注选号数量
     * @return 单注期望回报（元）
     */
    public double expectedReturnPerTicket(int pickSize) {
        if (pickSize <= 0 || pickSize >= PICK4_PRIZES.length) {
            return 0;
        }
        double expected = 0;
        for (int hits = 0; hits <= pickSize; hits += 1) {
            expected += LotteryKl8Statistics.exactHitProbability(pickSize, hits) * PICK4_PRIZES[hits];
        }
        return expected;
    }

    /**
     * 构建成本—概率曲线。
     *
     * @param pickSize          每注选号数量
     * @param minHitLevel       达标口径
     * @param maxTickets        最大注数
     * @param expectedPerTicket 单注期望回报
     * @param payoutRate        返奖率
     * @return 曲线行列表
     */
    private List<LotteryKl8CoverageCurveRowVO> buildCurve(
            int pickSize, int minHitLevel, int maxTickets, double expectedPerTicket, double payoutRate) {
        List<LotteryKl8CoverageCurveRowVO> rows = new ArrayList<>();
        double previousRate = 0;
        for (int tickets = 1; tickets <= maxTickets; tickets += 1) {
            double rate = LotteryKl8Statistics.atLeastOneTicketProbability(tickets, pickSize, minHitLevel);
            double cost = TICKET_PRICE_YUAN * tickets;
            double marginalLift = rate - previousRate;
            // 每提升 1 个百分点概率需要的钱：衡量「这一注买得值不值」
            double costPerPercentPoint = marginalLift <= 0 ? 0 : cost / (marginalLift * 100);
            rows.add(new LotteryKl8CoverageCurveRowVO(
                    tickets,
                    pickSize * tickets,
                    round(cost),
                    roundProbability(rate),
                    roundProbability(LotteryKl8Statistics.atLeastOneTicketProbability(tickets, pickSize, 3)),
                    roundProbability(LotteryKl8Statistics.atLeastOneTicketProbability(tickets, pickSize, pickSize)),
                    roundProbability(marginalLift),
                    round(costPerPercentPoint),
                    round(expectedPerTicket * tickets),
                    roundProbability(payoutRate)));
            previousRate = rate;
        }
        return rows;
    }

    /**
     * 反查达到各目标概率所需的最少注数。
     *
     * @param pickSize    每注选号数量
     * @param minHitLevel 达标口径
     * @return 目标反查行列表
     */
    private List<LotteryKl8CoverageTargetRowVO> buildTargets(int pickSize, int minHitLevel) {
        List<LotteryKl8CoverageTargetRowVO> rows = new ArrayList<>();
        for (double target : TARGET_RATES) {
            int tickets = LotteryKl8Statistics.ticketsForTargetProbability(target, pickSize, minHitLevel);
            double achieved = tickets == 0
                    ? 0
                    : LotteryKl8Statistics.atLeastOneTicketProbability(tickets, pickSize, minHitLevel);
            rows.add(new LotteryKl8CoverageTargetRowVO(
                    target,
                    tickets,
                    tickets == 0 ? 0 : pickSize * tickets,
                    round(TICKET_PRICE_YUAN * tickets),
                    roundProbability(achieved),
                    round(expectedReturnPerTicket(pickSize) * tickets)));
        }
        return rows;
    }

    /**
     * 生成结论：先讲清概率只能靠注数买，再讲清代价是长期亏损。
     *
     * @param singleRate        单注达标概率
     * @param targets           目标反查
     * @param payoutRate        返奖率
     * @param expectedPerTicket 单注期望回报
     * @param maxDisjoint       最多互不重复注数
     * @param bestValue         性价比最优的注数行
     * @param budgetYuan        预算
     * @param budgetTickets     预算内注数
     * @param budgetRate        预算内可达概率
     * @return 结论
     */
    private String buildConclusion(
            int minHitLevel,
            double singleRate,
            List<LotteryKl8CoverageTargetRowVO> targets,
            double payoutRate,
            double expectedPerTicket,
            int maxDisjoint,
            LotteryKl8CoverageCurveRowVO bestValue,
            double budgetYuan,
            int budgetTickets,
            double budgetRate) {
        LotteryKl8CoverageTargetRowVO half = targets.stream()
                .filter(row -> row.targetRate() == 0.50)
                .findFirst()
                .orElse(targets.isEmpty() ? null : targets.getFirst());
        LotteryKl8CoverageTargetRowVO ninetyFive = targets.stream()
                .filter(row -> row.targetRate() == 0.95)
                .findFirst()
                .orElse(null);

        String targetText = half == null || half.requiredTickets() == 0
                ? "在 80 个号码的上限内无法把中奖概率提到 50%。"
                : "把中奖概率提到 50%% 需要 %d 注 %d 个互不重复的号、成本 %.0f 元；提到 95%% 需要 %s。"
                        .formatted(half.requiredTickets(), half.coveredNumbers(), half.costYuan(),
                                ninetyFive == null || ninetyFive.requiredTickets() == 0
                                        ? "更多注数"
                                        : ninetyFive.requiredTickets() + " 注 " + ninetyFive.costYuan() + " 元");

        String budgetText = budgetYuan > 0
                ? "预算 %.0f 元可买 %d 注，达到中奖概率 %.2f%%。".formatted(budgetYuan, budgetTickets, budgetRate * 100)
                : "";

        return ("单注「至少中 %d 个」的概率恒为 %.2f%%（超几何分布），这是数学常量，任何选号策略都改不了它。"
                        + "唯一能提高中奖概率的办法是买更多互不重复的号：概率只取决于覆盖了多少个号，"
                        + "与「哪几个号凑成一注」完全无关，所以在 80 个号码的池子里最多 %d 注互不重复，已是理论最优。"
                        + "%s 单位成本性价比最高的是第 %d 注（每提升 1 个百分点概率约需 %.1f 元），"
                        + "此后每多买一注的边际收益持续递减。"
                        + "但必须说清代价：返奖率恒为 %.2f%%，每注期望回报 %.3f 元、期望亏损 %.3f 元，"
                        + "与注数无关。加注只让亏损来得更快更均匀，不改变长期亏损总额。%s")
                .formatted(minHitLevel, singleRate * 100, maxDisjoint, targetText,
                        bestValue.ticketCount(), bestValue.costPerPercentPoint(),
                        payoutRate * 100, expectedPerTicket, TICKET_PRICE_YUAN - expectedPerTicket, budgetText);
    }

    /**
     * 金额与比率类字段的舍入，保留 4 位小数。
     *
     * @param value 原始值
     * @return 舍入结果
     */
    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }

    /**
     * 概率字段的舍入，保留 6 位小数。
     * <p>
     * 刻意比 {@link #round(double)} 更精细：注数接近上限时概率已饱和到 0.99999x，
     * 按 4 位小数舍入会把 18~20 注全部压成 1.0000，
     * 恰好抹掉「加注边际收益如何归零」这段最需要看清的信息。
     *
     * @param value 原始值
     * @return 舍入结果
     */
    private double roundProbability(double value) {
        return Math.round(value * 1000000.0) / 1000000.0;
    }
}
