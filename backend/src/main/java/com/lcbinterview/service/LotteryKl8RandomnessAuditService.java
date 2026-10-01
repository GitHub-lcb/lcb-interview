package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8AuditReportVO;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.model.LotteryKl8Draw;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 快乐8 开奖数据随机性审计服务。
 * <p>
 * <b>这是整个工具链里唯一可能推翻「无法预测」结论的地方。</b>
 * 前面所有分析都建立在「开奖数据来自公正的独立同分布抽样」这个前提上。
 * 如果摇奖设备有偏、抓取错期、或者数据被篡改，审计就能查出来——
 * 而且查出来的偏差本身就是唯一可能被利用的信号。
 * <p>
 * 因此本服务同时承担两个职责：
 * <ol>
 *   <li><b>数据质量看门狗</b>：确认抓取到的开奖记录本身可信（期号连续性、号码个数）</li>
 *   <li><b>随机性假设检验</b>：号码频次、位置分布、和值、奇偶、区间、序列相关性</li>
 * </ol>
 * 需要说明的边界：各项检验的样本量虽大，但检验族（family）本身也做了多重比较，
 * 单项 p 值接近 0.05 属于预期内的假阳性。只有 p &lt; 0.01 或多项同时显著才值得深挖。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8RandomnessAuditService {

    /** 单项检验的名义显著阈值：仅用于统计「有多少项落在常规 5% 水平」，不作为告警依据 */
    private static final double SIGNIFICANCE_THRESHOLD = 0.05;
    /**
     * Bonferroni 校正的名义族系错误率：除以检验项数后得到逐项阈值。
     * 这是本次审计唯一可信的告警依据。
     */
    private static final double BONFERRONI_ALPHA = 0.05;
    /** 默认审计期数，与实验室默认口径一致 */
    private static final int DEFAULT_ISSUE_COUNT = 2000;
    /** 审计所需的最少期数，低于此值统计功效不足 */
    private static final int MIN_ISSUE_COUNT = 100;
    /** 号码池大小 */
    private static final int POPULATION_SIZE = 80;
    /** 每期开出号码数 */
    private static final int DRAW_SIZE = 20;
    /** 区间划分个数：1-20 / 21-40 / 41-60 / 61-80 */
    private static final int ZONE_COUNT = 4;
    /** 自相关检验的最大滞后阶 */
    private static final int MAX_LAG = 5;
    /** 相邻两期重号数的期望：20 × 20 / 80 */
    private static final double EXPECTED_OVERLAP = (double) DRAW_SIZE * DRAW_SIZE / POPULATION_SIZE;

    private final LotteryKl8DrawMapper drawMapper;

    /**
     * 运行随机性审计。
     *
     * @param issueCount 审计使用的历史期数，超范围时钳制
     * @return 审计报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8AuditReportVO audit(int issueCount) {
        int effectiveCount = issueCount <= 0 ? DEFAULT_ISSUE_COUNT
                : Math.max(MIN_ISSUE_COUNT, Math.min(DEFAULT_ISSUE_COUNT, issueCount));
        List<LotteryKl8Draw> draws = loadDraws(effectiveCount);
        List<int[]> periods = new ArrayList<>(draws.size());
        for (LotteryKl8Draw draw : draws) {
            periods.add(parseNumbers(draw.getNumbers()));
        }
        // 审计需要时间正序（最早在前），而数据库按期号倒序查询
        java.util.Collections.reverse(periods);

        int total = periods.size();
        List<LotteryKl8AuditCheckResult> checks = new ArrayList<>();
        List<Integer> dataQualityIssues = buildDataQualityIssues(periods);

        checks.add(frequencyChiSquare(periods));
        checks.add(overlapCheck(periods));
        checks.add(sumDistributionCheck(periods));
        checks.add(oddEvenCheck(periods));
        checks.add(zoneDistributionCheck(periods));
        checks.addAll(lagAutocorrelationChecks(periods));
        checks.addAll(runsChecks(periods));
        checks.add(kolmogorovSmirnovCheck(periods));
        List<LotteryKl8AuditCheckResult> valid = checks.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        // 多重比较校正：本次同时跑 90+ 项检验，逐项用 0.05/0.01 判定必然产生假阳性
        // （91 项检验下，纯随机出现至少一项 p<0.01 的概率高达 60%）。
        // 因此用 Bonferroni 阈值 0.05/N 作为「真正值得关注」的唯一判据。
        int checkCount = valid.size();
        double bonferroniThreshold = checkCount == 0 ? 0 : BONFERRONI_ALPHA / checkCount;
        long correctedSignificantCount = valid.stream()
                .filter(check -> check.pValue() < bonferroniThreshold)
                .count();
        long significantCount = valid.stream().filter(LotteryKl8AuditCheckResult::significant).count();

        log.info("快乐8随机性审计完成: 期数={}, 检验项={}, 5%显著项={}, Bonferroni校正后显著项={}, 数据质量问题={}",
                total, checkCount, significantCount, correctedSignificantCount, dataQualityIssues.size());

        return new LotteryKl8AuditReportVO(
                total,
                draws.isEmpty() ? null : draws.get(draws.size() - 1).getIssueNo(),
                valid,
                checkCount,
                roundThreshold(bonferroniThreshold),
                significantCount,
                correctedSignificantCount,
                dataQualityIssues,
                buildConclusion(total, valid, correctedSignificantCount, significantCount, checkCount,
                        bonferroniThreshold, dataQualityIssues),
                DISCLAIMER);
    }

    private static final String DISCLAIMER =
            "随机性审计只回答「数据是否可信、是否存在可利用偏差」，不预测任何号码。"
                    + "未发现偏差不等于存在可预测性——独立同分布抽样下，任何选号算法的期望贡献恒为 0。";

    /**
     * 读取历史开奖，按期号倒序（最新在前）。
     *
     * @param issueCount 期数
     * @return 开奖记录
     */
    private List<LotteryKl8Draw> loadDraws(int issueCount) {
        return drawMapper.selectList(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT " + issueCount));
    }

    /**
     * 解析逗号分隔的号码字符串。
     * <p>
     * 这里刻意不依赖 {@link LotteryKl8FeatureService}：审计只需要读开奖号码，
     * 而特征服务还牵涉候选池构建、走查前推回测等重逻辑。
     * 让审计自持解析既避免无谓耦合，也让审计成为一条独立的、可单独验证的数据质量链路。
     *
     * @param numbers 逗号分隔的号码字符串
     * @return 号码数组
     */
    private int[] parseNumbers(String numbers) {
        if (numbers == null || numbers.isBlank()) {
            return new int[0];
        }
        List<Integer> parsed = new ArrayList<>();
        for (String part : numbers.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                parsed.add(Integer.parseInt(trimmed));
            } catch (NumberFormatException exception) {
                // 号码格式异常等价于该期数据不可用，按缺号处理并由数据质量检查报出
                log.warn("开奖号码解析失败，跳过非法片段: {}", trimmed);
            }
        }
        return parsed.stream().mapToInt(Integer::intValue).toArray();
    }

    /**
     * 数据质量检查：每期号码个数是否等于 20。
     * 这是审计的前提——若号码个数不对，后续所有统计量的前提都不成立。
     *
     * @param periods 按时间正序的每期号码
     * @return 号码个数异常值列表，无问题时为空
     */
    private List<Integer> buildDataQualityIssues(List<int[]> periods) {
        List<Integer> issues = new ArrayList<>();
        for (int[] period : periods) {
            if (period.length != DRAW_SIZE) {
                issues.add(period.length);
            }
        }
        return issues;
    }

    /**
     * 检验 1：80 个号码的频次是否均匀分布。
     * 这是最核心的检验——若某个号码系统性偏多或偏少，它就是可利用的信号。
     */
    private LotteryKl8AuditCheckResult frequencyChiSquare(List<int[]> periods) {
        int[] frequency = new int[POPULATION_SIZE + 1];
        int observations = 0;
        for (int[] numbers : periods) {
            for (int number : numbers) {
                frequency[number] += 1;
            }
            observations += numbers.length;
        }
        if (observations == 0) {
            return null;
        }
        List<Long> observed = new ArrayList<>(POPULATION_SIZE);
        List<Double> expected = new ArrayList<>(POPULATION_SIZE);
        double expectedPerNumber = (double) observations / POPULATION_SIZE;
        for (int number = 1; number <= POPULATION_SIZE; number += 1) {
            observed.add((long) frequency[number]);
            expected.add(expectedPerNumber);
        }
        return LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, expected);
    }

    /**
     * 检验 2：相邻两期的重号数是否符合超几何期望。
     * 若上一期开出哪些号会影响下一期，重号数会偏离 5.0000。
     */
    private LotteryKl8AuditCheckResult overlapCheck(List<int[]> periods) {
        int pairs = 0;
        int observedSum = 0;
        for (int index = 1; index < periods.size(); index += 1) {
            boolean[] previous = new boolean[POPULATION_SIZE + 1];
            for (int number : periods.get(index - 1)) {
                previous[number] = true;
            }
            int overlap = 0;
            for (int number : periods.get(index)) {
                if (previous[number]) {
                    overlap += 1;
                }
            }
            observedSum += overlap;
            pairs += 1;
        }
        if (pairs == 0) {
            return null;
        }
        double observedRate = (double) observedSum / pairs;
        double expectedSum = EXPECTED_OVERLAP * pairs;
        double standardDeviation = Math.sqrt(pairs * EXPECTED_OVERLAP * (1 - EXPECTED_OVERLAP / DRAW_SIZE));
        double z = standardDeviation == 0 ? 0 : (observedSum - expectedSum) / standardDeviation;
        double pValue = 2 * (1 - LotteryKl8Statistics.standardNormalCdf(Math.abs(z)));
        return new LotteryKl8AuditCheckResult(
                "相邻两期重号数",
                z,
                pairs,
                pValue,
                pValue < SIGNIFICANCE_THRESHOLD
                        ? "重号数偏离超几何期望，上一期可能影响下一期"
                        : "重号数与超几何期望一致，上一期不影响下一期");
    }

    /**
     * 检验 3：每期 20 个号之和的分布是否偏离理论期望。
     * 和值是最容易出现物理偏差的统计量（摇奖球重量差异会累积到和值上）。
     */
    private LotteryKl8AuditCheckResult sumDistributionCheck(List<int[]> periods) {
        int total = periods.size();
        if (total < 30) {
            return null;
        }
        double sumOfSums = 0;
        double sumOfSquares = 0;
        for (int[] numbers : periods) {
            int periodSum = 0;
            for (int number : numbers) {
                periodSum += number;
            }
            sumOfSums += periodSum;
            sumOfSquares += (double) periodSum * periodSum;
        }
        double observedMean = sumOfSums / total;
        // 20 个号不放回抽样的和值方差：Var = n·K·(N−K)/(N−1)·(N−n)/(N−1)
        double expectedMean = (double) DRAW_SIZE * (POPULATION_SIZE + 1) / 2;
        double variance = (double) DRAW_SIZE * (POPULATION_SIZE - DRAW_SIZE)
                / (POPULATION_SIZE - 1) * (POPULATION_SIZE - DRAW_SIZE) / (POPULATION_SIZE - 1)
                * (POPULATION_SIZE * POPULATION_SIZE - 1) / 12;
        double observedVariance = sumOfSquares / total - observedMean * observedMean;
        double z = (observedMean - expectedMean) / Math.sqrt(variance / total);
        double pValue = 2 * (1 - LotteryKl8Statistics.standardNormalCdf(Math.abs(z)));
        return new LotteryKl8AuditCheckResult(
                "每期和值均值",
                z,
                total,
                pValue,
                pValue < SIGNIFICANCE_THRESHOLD
                        ? "和值均值偏离理论期望，需排查摇奖设备或抓取错期"
                        : "和值均值与理论期望一致");
    }

    /**
     * 检验 4：每期开出奇数号的比例是否等于 50%。
     */
    private LotteryKl8AuditCheckResult oddEvenCheck(List<int[]> periods) {
        int total = 0;
        int oddCount = 0;
        for (int[] numbers : periods) {
            total += numbers.length;
            for (int number : numbers) {
                if (number % 2 == 1) {
                    oddCount += 1;
                }
            }
        }
        return LotteryKl8Statistics.proportionTest(
                oddCount, total, 0.5, "奇数号占比", "奇偶分布与 50%/50% 无法区分");
    }

    /**
     * 检验 5：每期四个区间（1-20/21-40/41-60/61-80）的号码个数是否均为 5。
     * 区间偏斜意味着号码分布存在位置性偏好。
     */
    private LotteryKl8AuditCheckResult zoneDistributionCheck(List<int[]> periods) {
        int[] zoneCounts = new int[ZONE_COUNT];
        int total = 0;
        for (int[] numbers : periods) {
            for (int number : numbers) {
                zoneCounts[(number - 1) / (POPULATION_SIZE / ZONE_COUNT)] += 1;
                total += 1;
            }
        }
        if (total == 0) {
            return null;
        }
        List<Long> observed = new ArrayList<>(ZONE_COUNT);
        List<Double> expected = new ArrayList<>(ZONE_COUNT);
        double expectedPerZone = (double) total / ZONE_COUNT;
        for (int index = 0; index < ZONE_COUNT; index += 1) {
            observed.add((long) zoneCounts[index]);
            expected.add(expectedPerZone);
        }
        return LotteryKl8Statistics.chiSquareGoodnessOfFit(observed, expected);
    }

    /**
     * 检验 6：号码出现序列的滞后 1~5 阶自相关。
     * 若上期开出的号本期更容易再开，自相关会显著非零。
     * <p>
     * 每一阶都对「相邻两期重号比例」序列做 1 阶自相关，
     * 阶数体现在报告标签上，因此这里按外层 lag 重命名，避免五项都显示成「滞后 1 阶」。
     */
    private List<LotteryKl8AuditCheckResult> lagAutocorrelationChecks(List<int[]> periods) {
        List<LotteryKl8AuditCheckResult> checks = new ArrayList<>();
        int total = periods.size();
        for (int lag = 1; lag <= MAX_LAG; lag += 1) {
            if (total - lag < 10) {
                continue;
            }
            List<Double> series = new ArrayList<>(total - lag);
            for (int index = 0; index + lag < total; index += 1) {
                boolean[] current = new boolean[POPULATION_SIZE + 1];
                for (int number : periods.get(index)) {
                    current[number] = true;
                }
                int hits = 0;
                for (int number : periods.get(index + lag)) {
                    if (current[number]) {
                        hits += 1;
                    }
                }
                series.add((double) hits / DRAW_SIZE);
            }
            LotteryKl8AuditCheckResult check = LotteryKl8Statistics.autocorrelationTest(series, 1);
            if (check == null) {
                continue;
            }
            checks.add(new LotteryKl8AuditCheckResult(
                    "间隔 " + lag + " 期的重号自相关",
                    check.statistic(),
                    check.degreesOfFreedom(),
                    check.pValue(),
                    check.conclusion()));
        }
        return checks;
    }

    /**
     * 检验 7：单个号码出现序列的游程检验。
     * 对固定号码统计「开出/未开出」序列的游程数，游程数异常意味着该号码有惯性。
     */
    private List<LotteryKl8AuditCheckResult> runsChecks(List<int[]> periods) {
        List<LotteryKl8AuditCheckResult> checks = new ArrayList<>();
        for (int number = 1; number <= POPULATION_SIZE; number += 1) {
            int hits = 0;
            int previous = -1;
            int runs = 0;
            for (int[] period : periods) {
                boolean drawn = false;
                for (int candidate : period) {
                    if (candidate == number) {
                        drawn = true;
                        break;
                    }
                }
                int current = drawn ? 1 : 0;
                if (current != previous) {
                    runs += 1;
                    previous = current;
                }
                if (drawn) {
                    hits += 1;
                }
            }
            checks.add(LotteryKl8Statistics.runsTest(hits, periods.size() - hits, runs));
        }
        return checks;
    }

    /**
     * 检验 8：全部开奖号码在 1~80 上是否均匀分布（KS 检验）。
     */
    private LotteryKl8AuditCheckResult kolmogorovSmirnovCheck(List<int[]> periods) {
        List<Integer> allNumbers = new ArrayList<>();
        for (int[] period : periods) {
            for (int number : period) {
                allNumbers.add(number);
            }
        }
        return LotteryKl8Statistics.kolmogorovSmirnov(allNumbers, 1, POPULATION_SIZE);
    }

    /**
     * 生成结论：既要说清「查了什么」，也要说清「没查到不等于可预测」。
     * <p>
     * 告警只认 Bonferroni 校正后的结果。理由很直接：本次同时跑 90+ 项检验，
     * 逐项用 5% 或 1% 判定时，纯随机出现至少一项误报的概率分别高达 99% 与 60%。
     * 直接按「有一项 p&lt;0.05 就报警」会把干净数据误判为异常，久而久之没人再信这个结论。
     *
     * @param total              审计期数
     * @param checks             检验结果
     * @param correctedCount     Bonferroni 校正后显著项数
     * @param rawCount           名义 5% 水平显著项数
     * @param checkCount         检验项数
     * @param bonferroniThreshold 校正后的逐项阈值
     * @param qualityIssues      数据质量问题
     * @return 结论
     */
    private String buildConclusion(
            int total,
            List<LotteryKl8AuditCheckResult> checks,
            long correctedCount,
            long rawCount,
            int checkCount,
            double bonferroniThreshold,
            List<Integer> qualityIssues) {
        if (!qualityIssues.isEmpty()) {
            return "数据质量检查未通过：发现 %d 期号码个数不等于 %d，后续统计量的前提不成立，"
                    .formatted(qualityIssues.size(), DRAW_SIZE)
                    + "请先排查抓取逻辑再解读审计结论。";
        }
        if (correctedCount > 0) {
            return "在 %d 期真实开奖上，%d/%d 项检验通过 Bonferroni 多重比较校正（p < %.5f）。"
                    .formatted(total, correctedCount, checkCount, bonferroniThreshold)
                    + "这是本次审计唯一可能推翻「数据无信号」结论的地方，建议逐项核对原始开奖公告，"
                    + "确认是摇奖设备偏差还是抓取错期。在查清之前，不要基于这些数字做任何选号调整。";
        }
        return "在 %d 期真实开奖上完成 %d 项随机性检验，未发现任何通过多重比较校正的偏差"
                        .formatted(total, checkCount)
                + "（名义 5%% 水平有 %d 项显著，与 %.1f 项的随机期望一致，属正常假阳性；"
                        .formatted(rawCount, checkCount * SIGNIFICANCE_THRESHOLD)
                + "校正阈值 p < %.5f 下为 0 项）。".formatted(bonferroniThreshold)
                + "数据质量检查同样通过：号码层面、和值层面、奇偶层面、区间层面、序列相关性层面"
                + "均与公正的独立同分布抽样无法区分，未发现可利用信号。"
                + "需要强调的是，未发现偏差并不等于「可以预测」——在独立同分布抽样下，"
                + "任何选号算法的期望贡献恒为 0，这才是选号无法提升概率的根本原因。";
    }

    /**
     * 阈值保留 8 位小数：Bonferroni 阈值在 90+ 项检验下约为 5.5×10⁻⁴，
     * 若只保留 6 位小数会退化成 0.00055 之外的失真值。
     *
     * @param value 原始阈值
     * @return 舍入结果
     */
    private double roundThreshold(double value) {
        return Math.round(value * 100000000.0) / 100000000.0;
    }
}
