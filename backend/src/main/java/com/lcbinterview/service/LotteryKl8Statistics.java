package com.lcbinterview.service;

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
        long numerator = combinations(DRAW_SIZE, hits) * combinations(POPULATION_SIZE - DRAW_SIZE, pickSize - hits);
        long denominator = combinations(POPULATION_SIZE, pickSize);
        return denominator == 0 ? 0 : (double) numerator / denominator;
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
     * 组合数 C(n, k)，用 long 计算并做溢出保护。
     *
     * @param n 总数
     * @param k 选取数量
     * @return 组合数
     */
    private static long combinations(int n, int k) {
        if (k < 0 || k > n) {
            return 0;
        }
        int effectiveK = Math.min(k, n - k);
        long result = 1;
        for (int index = 1; index <= effectiveK; index += 1) {
            result = result * (n - effectiveK + index) / index;
        }
        return result;
    }
}
