package com.lcbinterview.service;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 随机性检验统计工具，为快乐8 开奖数据审计提供各类检验的统计量与 p 值。
 * <p>
 * 这里的每个方法都对应一个经典的假设检验。审计的目的不是「找出能赢的规律」，
 * 而是回答一个更基础的问题：<b>这批开奖数据本身是否可信、是否真随机</b>。
 * 只有确认数据来自公正的独立同分布抽样，「无法预测」这个结论才成立；
 * 反之若查出偏差，偏差本身就是唯一可能被利用的信号。
 * <p>
 * 实现说明：JDK 没有内置不完全伽马函数与分布尾概率，卡方检验的 p 值必须自行计算，
 * 因此这里按 Numerical Recipes 的级数展开与连分式展开实现 Q(a,x)。
 * 所有方法均为纯函数，无状态，可安全并发调用。
 */
public final class LotteryKl8Statistics {

    /** 号码池大小 */
    private static final int POPULATION_SIZE = 80;
    /** 每期开出号码数 */
    private static final int DRAW_SIZE = 20;
    /** 双侧 95% 置信度对应的标准正态分位数 */
    private static final double Z_ALPHA_95 = 1.959963985;
    /** 80% 检验效能对应的标准正态分位数 */
    private static final double Z_POWER_80 = 0.8416212336;
    /** 级数/连分式展开的迭代上限，达到即认为已收敛 */
    private static final int MAX_ITERATIONS = 300;
    /** 收敛判据：相对误差小于该值即停止展开 */
    private static final double EPSILON = 1e-14;

    private LotteryKl8Statistics() {
    }

    /**
     * 超几何分布：选 pickSize 个号码，恰好命中 hits 个的概率。
     *
     * @param pickSize 选号数量
     * @param hits     命中数量
     * @return 概率，参数非法时返回 0
     */
    public static double exactHitProbability(int pickSize, int hits) {
        if (pickSize <= 0 || hits < 0 || hits > pickSize || hits > DRAW_SIZE) {
            return 0;
        }
        BigInteger numerator = combinations(DRAW_SIZE, hits)
                .multiply(combinations(POPULATION_SIZE - DRAW_SIZE, pickSize - hits));
        return ratio(numerator, combinations(POPULATION_SIZE, pickSize));
    }

    /**
     * 超几何分布：选 pickSize 个号码，至少命中 minHits 个的概率。
     *
     * @param pickSize 选号数量
     * @param minHits  最少命中数量
     * @return 概率
     */
    public static double atLeastHitProbability(int pickSize, int minHits) {
        double probability = 0;
        for (int hits = Math.max(0, minHits); hits <= pickSize; hits += 1) {
            probability += exactHitProbability(pickSize, hits);
        }
        return Math.min(1, probability);
    }

    /**
     * 理论期望命中数：pickSize × 20 / 80。
     *
     * @param pickSize 选号数量
     * @return 期望命中数
     */
    public static double expectedHits(int pickSize) {
        return (double) pickSize * DRAW_SIZE / POPULATION_SIZE;
    }

    /**
     * Wilson 区间：小样本比例估计比正态近似更稳健，不会出现负下限或超过 1 的上限。
     *
     * @param successes 命中次数
     * @param trials    样本量
     * @return 长度为 2 的数组，[下限, 上限]
     */
    public static double[] wilsonInterval(int successes, int trials) {
        if (trials <= 0) {
            return new double[]{0, 1};
        }
        double rate = (double) successes / trials;
        double zSquared = Z_ALPHA_95 * Z_ALPHA_95;
        double denominator = 1 + zSquared / trials;
        double center = (rate + zSquared / (2.0 * trials)) / denominator;
        double margin = Z_ALPHA_95 * Math.sqrt(rate * (1 - rate) / trials + zSquared / (4.0 * trials * trials))
                / denominator;
        return new double[]{Math.max(0, center - margin), Math.min(1, center + margin)};
    }

    /**
     * 观测率相对理论基线的 z 值（正态近似）。
     *
     * @param successes    命中次数
     * @param trials       样本量
     * @param baselineRate 理论基线概率
     * @return z 值；样本量不足时返回 0
     */
    public static double zScore(int successes, int trials, double baselineRate) {
        if (trials <= 0 || baselineRate <= 0 || baselineRate >= 1) {
            return 0;
        }
        double standardError = Math.sqrt(baselineRate * (1 - baselineRate) / trials);
        return standardError == 0 ? 0 : ((double) successes / trials - baselineRate) / standardError;
    }

    /**
     * 在双侧 α=0.05、检验效能 80% 下，检出指定绝对提升量所需的样本量。
     * 用于回答「跑了多少期才足以确认 +1 个百分点是真实提升」。
     *
     * @param baselineRate 基线概率
     * @param absoluteLift 期望检出的绝对提升量（如 0.01 表示 +1 个百分点）
     * @return 所需期数；参数非法时返回 0
     */
    public static int requiredSampleSize(double baselineRate, double absoluteLift) {
        if (baselineRate <= 0 || baselineRate >= 1 || absoluteLift <= 0) {
            return 0;
        }
        double targetRate = Math.min(0.999999, baselineRate + absoluteLift);
        double term = Z_ALPHA_95 * Math.sqrt(baselineRate * (1 - baselineRate))
                + Z_POWER_80 * Math.sqrt(targetRate * (1 - targetRate));
        double size = Math.pow(term / absoluteLift, 2);
        return (int) Math.ceil(size);
    }

    /**
     * 多注互不重复时，至少有一注命中 minHits 个及以上的精确概率。
     * <p>
     * 精确算法（非蒙特卡洛）：设 M 注互不重复、覆盖 4M 个号码，K 为落在覆盖集内的
     * 中奖号码数。给定 K，中奖号码在覆盖集内等概率分布，因此「没有任何一注达标」的概率
     * 等于把覆盖集内的 K 个中奖号码分配到 M 注、每注至多 minHits−1 个的分配数占 C(4M, K) 的比例，
     * 即多项式 (Σ_{i<minHits} C(pickSize, i)·x^i)^M 的 x^K 系数。
     * <p>
     * 关键性质：结果只依赖 M 与覆盖集大小，与「哪几个号凑成一注」完全无关。
     * 这意味着「不重复」本身就是最优解——概率随并集号码数单调递增，
     * 因此任何选号策略对多注概率的贡献恒为 0。
     *
     * @param tickets  注数
     * @param pickSize 每注选号数量
     * @param minHits  最少命中数量
     * @return 概率；注数或选号非法、或覆盖号码超过 80 时返回 0 或 1
     */
    public static double atLeastOneTicketProbability(int tickets, int pickSize, int minHits) {
        if (tickets <= 0 || pickSize <= 0 || minHits <= 0) {
            return 0;
        }
        // 本公式的前提是各注互不重复，因此注数不能超过号码池能容纳的上限：
        // 超出的注数必然要重复号码，重复只会拉低概率，按上限计算才是正确口径。
        int effectiveTickets = Math.min(tickets, maxDisjointTickets(pickSize));
        int covered = pickSize * effectiveTickets;
        BigInteger totalOutcomes = combinations(POPULATION_SIZE, DRAW_SIZE);
        List<BigInteger> allocation = ticketAllocationCounts(effectiveTickets, pickSize, minHits);
        double noTicketReached = 0;
        for (int inCovered = 0; inCovered <= Math.min(DRAW_SIZE, covered); inCovered += 1) {
            BigInteger withinCovered = combinations(covered, inCovered);
            BigInteger outsideCovered = combinations(POPULATION_SIZE - covered, DRAW_SIZE - inCovered);
            if (withinCovered.signum() == 0 || outsideCovered.signum() == 0) {
                continue;
            }
            // P(K = inCovered)：20 个中奖号码里有 inCovered 个落在覆盖集内
            double inCoveredProbability = ratio(withinCovered.multiply(outsideCovered), totalOutcomes);
            // 给定 K，每注至多 minHits-1 个的分配方案数占 C(covered, K) 的比例
            BigInteger allocations = inCovered < allocation.size() ? allocation.get(inCovered) : BigInteger.ZERO;
            if (allocations.signum() == 0) {
                continue;
            }
            noTicketReached += inCoveredProbability * ratio(allocations, withinCovered);
        }
        return Math.max(0, Math.min(1, 1 - noTicketReached));
    }

    /**
     * 计算多项式 (Σ_{i<minHits} C(pickSize, i)·x^i)^tickets 的全部系数。
     * 系数 [x^k] 表示「把 k 个中奖号码分给 tickets 注、每注至多 minHits−1 个」的分配方案数。
     *
     * @param tickets  注数
     * @param pickSize 每注选号数量
     * @param minHits  最少命中数量
     * @return 系数列表，下标即次数
     */
    private static List<BigInteger> ticketAllocationCounts(int tickets, int pickSize, int minHits) {
        int maxPerTicket = Math.min(minHits - 1, pickSize);
        List<BigInteger> polynomial = new ArrayList<>(List.of(BigInteger.ONE));
        for (int ticket = 0; ticket < tickets; ticket += 1) {
            // 乘一次 (Σ_{i<maxPerTicket+1} C(pickSize, i)·x^i) 后，次数上界增加 maxPerTicket
            List<BigInteger> next = new ArrayList<>(Collections.nCopies(
                    polynomial.size() + maxPerTicket, BigInteger.ZERO));
            for (int existing = 0; existing < polynomial.size(); existing += 1) {
                for (int added = 0; added <= maxPerTicket; added += 1) {
                    BigInteger coefficient = combinations(pickSize, added);
                    next.set(existing + added, next.get(existing + added)
                            .add(polynomial.get(existing).multiply(coefficient)));
                }
            }
            polynomial = next;
        }
        return polynomial;
    }

    /**
     * 反查：达到目标概率所需的最少注数（号码互不重复口径）。
     *
     * @param targetRate 目标概率
     * @param pickSize   每注选号数量
     * @param minHits    最少命中数量
     * @return 最少注数；目标非法或全号覆盖仍无法达到时返回 0
     */
    public static int ticketsForTargetProbability(double targetRate, int pickSize, int minHits) {
        if (targetRate <= 0 || targetRate > 1 || pickSize <= 0 || minHits <= 0) {
            return 0;
        }
        int maxTickets = POPULATION_SIZE / pickSize;
        for (int tickets = 1; tickets <= maxTickets; tickets += 1) {
            if (atLeastOneTicketProbability(tickets, pickSize, minHits) >= targetRate) {
                return tickets;
            }
        }
        return 0;
    }

    /**
     * 多注互不重复口径下，某个注数能够达到的覆盖上限（受 80 个号码约束）。
     *
     * @param pickSize 每注选号数量
     * @return 最大注数
     */
    public static int maxDisjointTickets(int pickSize) {
        return pickSize <= 0 ? 0 : POPULATION_SIZE / pickSize;
    }

    // ------------------------------------------------------------------
    // 以下为随机性审计专用的假设检验
    // ------------------------------------------------------------------

    /**
     * 卡方拟合优度检验：判断观测频次是否与期望频次一致。
     * <p>
     * p 值由不完全伽马函数 Q(df/2, χ²/2) 得到，卡方分布的尾概率即该值。
     *
     * @param observed 各桶观测频次
     * @param expected 各桶期望频次，长度须与 observed 一致
     * @return 卡方检验结果；样本不足或期望频次非正时返回 null
     */
    public static LotteryKl8AuditCheckResult chiSquareGoodnessOfFit(
            List<Long> observed, List<Double> expected) {
        if (observed.size() != expected.size() || observed.size() < 2) {
            return null;
        }
        int buckets = observed.size();
        int degreesOfFreedom = buckets - 1;
        double chiSquare = 0;
        for (int index = 0; index < buckets; index += 1) {
            double want = expected.get(index);
            if (want <= 0) {
                return null;
            }
            double difference = observed.get(index) - want;
            chiSquare += difference * difference / want;
        }
        double pValue = regularizedGammaQ(degreesOfFreedom / 2.0, chiSquare / 2.0);
        return new LotteryKl8AuditCheckResult(
                "卡方拟合优度",
                chiSquare,
                degreesOfFreedom,
                pValue,
                describeChiSquare(pValue, degreesOfFreedom));
    }

    /**
     * 游程检验：判断「命中/未命中」序列中同类项的连续段数量是否符合随机预期。
     * <p>
     * 随机序列的游程数期望为 2·H·M/n + 1，方差为 2·H·M·(2·H·M−n)/(n²(n−1))。
     * 游程数显著偏多意味着命中与未命中频繁交替（序列相关）；
     * 显著偏少意味着命中扎堆（号码有惯性）。两者都会破坏独立同分布假设。
     *
     * @param hits   观测序列中命中项个数
     * @param misses 观测序列中未命中项个数
     * @param runs   实际游程数
     * @return 游程检验结果；样本不足时返回 null
     */
    public static LotteryKl8AuditCheckResult runsTest(int hits, int misses, int runs) {
        int total = hits + misses;
        if (total < 2 || hits == 0 || misses == 0 || runs <= 0) {
            return null;
        }
        double product = 2.0 * hits * misses;
        double expectedRuns = product / total + 1;
        double variance = product * (product - total) / ((double) total * total * (total - 1));
        if (variance <= 0) {
            return null;
        }
        double z = (runs - expectedRuns) / Math.sqrt(variance);
        double pValue = 2 * (1 - standardNormalCdf(Math.abs(z)));
        return new LotteryKl8AuditCheckResult(
                "游程检验",
                z,
                total,
                pValue,
                describeTwoSided(pValue, "游程数与随机序列无法区分"));
    }

    /**
     * 自相关检验：判断某个 0/1 序列是否存在显著的滞后相关。
     *
     * @param series       观测序列
     * @param lag          滞后期数
     * @return 自相关检验结果；样本不足时返回 null
     */
    public static LotteryKl8AuditCheckResult autocorrelationTest(List<Double> series, int lag) {
        int total = series.size();
        if (total < 10 || lag <= 0 || lag >= total) {
            return null;
        }
        double mean = 0;
        for (double value : series) {
            mean += value;
        }
        mean /= total;
        double varianceSum = 0;
        for (double value : series) {
            double centered = value - mean;
            varianceSum += centered * centered;
        }
        if (varianceSum <= 0) {
            return null;
        }
        double covariance = 0;
        for (int index = 0; index + lag < total; index += 1) {
            covariance += (series.get(index) - mean) * (series.get(index + lag) - mean);
        }
        double correlation = covariance / varianceSum;
        // 渐近标准误 1/sqrt(n)，用于判断该滞后阶是否显著非零
        double standardError = 1 / Math.sqrt(total);
        double z = correlation / standardError;
        double pValue = 2 * (1 - standardNormalCdf(Math.abs(z)));
        return new LotteryKl8AuditCheckResult(
                "滞后 " + lag + " 阶自相关",
                correlation,
                total,
                pValue,
                describeTwoSided(pValue, "该滞后阶与独立开奖无法区分"));
    }

    /**
     * Kolmogorov-Smirnov 单样本检验：判断观测值的经验分布是否与均匀分布一致。
     * <p>
     * 用于检验「开奖号码在 1~80 上是否均匀分布」，可直接捕捉位置层面的系统性偏移。
     *
     * @param observations 观测值，取值范围应为 [lowerBound, upperBound]
     * @param lowerBound   均匀分布下界（含）
     * @param upperBound   均匀分布上界（含）
     * @return KS 检验结果；样本不足时返回 null
     */
    public static LotteryKl8AuditCheckResult kolmogorovSmirnov(
            List<Integer> observations, int lowerBound, int upperBound) {
        int total = observations.size();
        int span = upperBound - lowerBound + 1;
        if (total < 20 || span <= 0) {
            return null;
        }
        int[] counts = new int[span];
        for (int value : observations) {
            if (value >= lowerBound && value <= upperBound) {
                counts[value - lowerBound] += 1;
            }
        }
        double maxDeviation = 0;
        int cumulative = 0;
        for (int index = 0; index < span; index += 1) {
            cumulative += counts[index];
            double empirical = (double) cumulative / total;
            double expected = (double) (index + 1) / span;
            maxDeviation = Math.max(maxDeviation, Math.abs(empirical - expected));
        }
        // 渐近分布：sqrt(n)·D 的临界值在 α=0.05 下约为 1.358
        double scaled = Math.sqrt(total) * maxDeviation;
        double pValue = kolmogorovAsymptoticPValue(scaled);
        return new LotteryKl8AuditCheckResult(
                "KS 均匀性检验",
                maxDeviation,
                total,
                pValue,
                describeTwoSided(pValue, "号码在 1~80 上的分布与均匀分布无法区分"));
    }

    /**
     * 比例的双侧检验：判断观测计数与理论期望是否存在显著差异。
     * 样本量足够大时用正态近似即可，本项目所有比例检验的样本量都在万级以上。
     *
     * @param successes    观测成功次数
     * @param trials       样本量
     * @param expectedRate 理论期望比例
     * @param name         检验名称
     * @param conclusion   结论模板
     * @return 检验结果；样本不足时返回 null
     */
    public static LotteryKl8AuditCheckResult proportionTest(
            int successes, int trials, double expectedRate, String name, String conclusion) {
        if (trials <= 0 || expectedRate <= 0 || expectedRate >= 1) {
            return null;
        }
        double z = zScore(successes, trials, expectedRate);
        double pValue = 2 * (1 - standardNormalCdf(Math.abs(z)));
        return new LotteryKl8AuditCheckResult(name, z, trials, pValue,
                describeTwoSided(pValue, conclusion));
    }

    /**
     * 正则化不完全伽马函数 Q(a,x) = 1 − P(a,x)，即伽马分布的上尾概率。
     * <p>
     * 卡方分布的尾概率可表示为 Q(df/2, χ²/2)，因此这是卡方 p 值的核心计算。
     * 采用 Numerical Recipes 的标准做法：x &lt; a+1 用级数展开，否则用连分式展开。
     *
     * @param a 形状参数
     * @param x 自变量
     * @return 上尾概率，取值 [0,1]
     */
    public static double regularizedGammaQ(double a, double x) {
        if (a <= 0 || x < 0) {
            return 0;
        }
        if (x == 0) {
            return 1;
        }
        if (x < a + 1) {
            // 级数展开求 P(a,x)，再取补
            return 1 - gammaLowerSeries(a, x);
        }
        return gammaUpperContinuedFraction(a, x);
    }

    /**
     * 级数展开计算正则化下侧概率 P(a,x)。
     *
     * @param a 形状参数
     * @param x 自变量
     * @return P(a,x)
     */
    private static double gammaLowerSeries(double a, double x) {
        double sum = 1 / a;
        double term = sum;
        double denominator = a;
        for (int index = 1; index <= MAX_ITERATIONS; index += 1) {
            denominator += 1;
            term *= x / denominator;
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * EPSILON) {
                break;
            }
        }
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    }

    /**
     * 连分式展开计算正则化上侧概率 Q(a,x)。
     *
     * @param a 形状参数
     * @param x 自变量
     * @return Q(a,x)
     */
    private static double gammaUpperContinuedFraction(double a, double x) {
        double tiny = 1e-300;
        double b = x + 1 - a;
        double c = 1 / tiny;
        double d = 1 / b;
        double fraction = d;
        for (int index = 1; index <= MAX_ITERATIONS; index += 1) {
            double an = -index * (index - a);
            b += 2;
            d = an * d + b;
            if (Math.abs(d) < tiny) {
                d = tiny;
            }
            c = b + an / c;
            if (Math.abs(c) < tiny) {
                c = tiny;
            }
            d = 1 / d;
            double delta = d * c;
            fraction *= delta;
            if (Math.abs(delta - 1) < EPSILON) {
                break;
            }
        }
        return Math.exp(-x + a * Math.log(x) - logGamma(a)) * fraction;
    }

    /**
     * 标准正态分布的累积分布函数。
     *
     * @param value 标准正态变量取值
     * @return 累积概率
     */
    public static double standardNormalCdf(double value) {
        return 0.5 * (1 + erf(value / Math.sqrt(2)));
    }

    /**
     * 误差函数 erf(x) = (2/√π)∫₀ˣ e^(−t²) dt。
     * <p>
     * 采用 Abramowitz-Stegun 7.1.26 的高精度近似，绝对误差小于 1.5×10⁻⁷，
     * 对本项目「是否显著」的判定完全够用。
     *
     * @param value 自变量
     * @return 误差函数值
     */
    public static double erf(double value) {
        double sign = value < 0 ? -1 : 1;
        double x = Math.abs(value);
        double t = 1 / (1 + 0.3275911 * x);
        double polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
                - 0.284496736) * t + 0.254829592) * t;
        return sign * (1 - polynomial * Math.exp(-x * x));
    }

    /**
     * KS 统计量的渐近 p 值：P(sqrt(n)·D > d)。
     * <p>
     * 使用 Kolmogorov 分布的经典级数展开 Q_K(d) = 2Σ(−1)^(k−1)·exp(−2k²d²)。
     *
     * @param scaled 已按样本量开方缩放的 KS 统计量
     * @return p 值
     */
    private static double kolmogorovAsymptoticPValue(double scaled) {
        if (scaled <= 0) {
            return 1;
        }
        double sum = 0;
        for (int k = 1; k <= 100; k += 1) {
            double term = Math.exp(-2.0 * k * k * scaled * scaled);
            sum += (k % 2 == 1 ? 1 : -1) * term;
            if (term < 1e-12) {
                break;
            }
        }
        return Math.max(0, Math.min(1, 2 * sum));
    }

    /**
     * 卡方检验结论文案。
     *
     * @param pValue         p 值
     * @param degreesOfFreedom 自由度
     * @return 中文结论
     */
    private static String describeChiSquare(double pValue, int degreesOfFreedom) {
        if (pValue < 0.01) {
            return "分布显著偏离均匀（自由度 %d），值得进一步排查数据源或摇奖设备".formatted(degreesOfFreedom);
        }
        if (pValue < 0.05) {
            return "分布偏离均匀但仅达 5%% 水平（自由度 %d），单次偶然的可能性较大"
                    .formatted(degreesOfFreedom);
        }
        return "分布与均匀分布一致（自由度 %d），未见号码层面的系统性偏差".formatted(degreesOfFreedom);
    }

    /**
     * 双侧检验结论文案。
     *
     * @param pValue     p 值
     * @param conclusion 无显著差异时的结论
     * @return 中文结论
     */
    private static String describeTwoSided(double pValue, String conclusion) {
        if (pValue < 0.01) {
            return "存在显著偏差（p < 0.01），值得进一步排查";
        }
        if (pValue < 0.05) {
            return "偏差达到 5%% 显著水平，单次偶然的可能性较大";
        }
        return conclusion;
    }

    /**
     * 组合数 C(n, k)，用 {@link BigInteger} 精确计算。
     * <p>
     * 这里刻意不用 long：覆盖概率需要 C(80, 20) ≈ 3.5×10¹⁸，而连乘中间量
     * （如 C(79, 19) × 80 ≈ 7.1×10¹⁹）已经超出 long 上限 9.2×10¹⁸，
     * 用 long 会在大 n、k 场景静默溢出成负数。
     *
     * @param n 总数
     * @param k 选取数量
     * @return 组合数
     */
    private static BigInteger combinations(int n, int k) {
        if (k < 0 || k > n) {
            return BigInteger.ZERO;
        }
        int effectiveK = Math.min(k, n - k);
        BigInteger result = BigInteger.ONE;
        for (int index = 1; index <= effectiveK; index += 1) {
            result = result.multiply(BigInteger.valueOf(n - effectiveK + index))
                    .divide(BigInteger.valueOf(index));
        }
        return result;
    }

    /**
     * BigInteger 之间的浮点除法。
     * <p>
     * 不能直接用 {@link BigInteger#divide(BigInteger)}：那是整数除法，
     * C(20,4) / C(80,4) 会被截断成 0。组合数最大到 C(80,20) ≈ 3.5×10¹⁸，
     * double 的 16 位有效数字足以支撑 4 位小数的输出精度。
     *
     * @param numerator   分子
     * @param denominator 分母
     * @return 商；分母为 0 时返回 0
     */
    private static double ratio(BigInteger numerator, BigInteger denominator) {
        if (denominator.signum() == 0) {
            return 0;
        }
        return numerator.doubleValue() / denominator.doubleValue();
    }

    /**
     * 朗博函数 ln Γ(x)，用于不完全伽马函数的归一化因子。
     *
     * @param value 自变量
     * @return ln Γ(value)
     */
    private static double logGamma(double value) {
        // Lanczos 近似，g=7、9 个系数，对 x>0 精度约 1e-15
        double[] coefficients = {
                0.99999999999980993, 676.5203681218851, -1259.1392167224028,
                771.32342877765313, -176.61502916214059, 12.507343278686905,
                -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        };
        if (value < 0.5) {
            // 反射公式处理 x < 0.5 的情形
            return Math.log(Math.PI / Math.sin(Math.PI * value)) - logGamma(1 - value);
        }
        double shifted = value - 1;
        double series = coefficients[0];
        for (int index = 1; index < coefficients.length; index += 1) {
            series += coefficients[index] / (shifted + index);
        }
        double t = shifted + 7.5;
        return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
    }
}
