package com.lcbinterview.service;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 快乐8 概率与统计工具，为概率实验室提供理论基线、区间估计和显著性检验。
 * <p>
 * 快乐8 每期从 80 个号码中随机开出 20 个，任意固定 5 号码组合的命中数服从超几何分布，
 * 期望命中数恒为 5 × 20 / 80 = 1.25。这意味着「单注命中概率」是数学常量，
 * 任何选号策略都无法改变它；能改变的是多注组合「至少中一注」的概率，
 * 以及「观察到的提升究竟是真实优势还是随机噪声」的判断。
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
}
