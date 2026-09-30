package com.lcbinterview.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Jev System One 单个问题的答案。
 *
 * 三种原语共用同一个答案壳，按类型取对应字段：
 * noul 取 {@link #probability}，choice 取 {@link #choice} 与 {@link #probabilities}，
 * score 取 {@link #score}、{@link #legend} 与 {@link #probabilities}。
 * 置信度 confidence 由概率分布形状推导，官方文档明确它表示「分布有多尖锐」，
 * 不等于「答案正确的概率」，因此只能用于分级路由，不能当作正确率。
 *
 * @param id            对应的问题标识
 * @param type          答案类型：noul / choice / score
 * @param probability   Noul 的 0-1 概率，非 Noul 时为 null
 * @param choice        Choice 选中的选项值，非 Choice 时为 null
 * @param score         Score 的档位位置（可落在档位之间），非 Score 时为 null
 * @param probabilities 全量概率分布，键为选项值或档位序号字符串
 * @param confidence    置信度 0-1，Noul 无此字段
 * @param legend        Score 的档位文字回传，键为档位序号字符串
 */
public record JevAnswer(
        String id,
        String type,
        Double probability,
        String choice,
        Double score,
        Map<String, Double> probabilities,
        Double confidence,
        Map<String, String> legend
) {

    /**
     * 兼容不含 legend 的调用方。
     *
     * @param id            问题标识
     * @param type          答案类型
     * @param probability   Noul 概率
     * @param choice        Choice 选项值
     * @param score         Score 档位位置
     * @param probabilities 概率分布
     * @param confidence    置信度
     */
    public JevAnswer(
            String id,
            String type,
            Double probability,
            String choice,
            Double score,
            Map<String, Double> probabilities,
            Double confidence) {
        this(id, type, probability, choice, score, probabilities, confidence, Map.of());
    }

    /**
     * 判断是否为 Noul 答案。
     *
     * @return true 表示是/否概率
     */
    public boolean isNoul() {
        return JevQuestion.TYPE_NOUL.equals(type);
    }

    /**
     * 判断是否为 Choice 答案。
     *
     * @return true 表示多选一
     */
    public boolean isChoice() {
        return JevQuestion.TYPE_CHOICE.equals(type);
    }

    /**
     * 判断是否为 Score 答案。
     *
     * @return true 表示有序量表
     */
    public boolean isScore() {
        return JevQuestion.TYPE_SCORE.equals(type);
    }

    /**
     * 读取 Noul 概率，缺失时返回退避值。
     * 上游偶尔会省略 probabilities 等可选字段，这里统一收敛，避免调用方到处判空。
     *
     * @param fallback 概率缺失时的退避值
     * @return 0-1 之间的概率
     */
    public double probabilityOr(double fallback) {
        if (probability == null || probability.isNaN()) {
            return fallback;
        }
        return Math.clamp(probability, 0.0, 1.0);
    }

    /**
     * 读取置信度，缺失时返回 0。
     *
     * @return 0-1 之间的置信度
     */
    public double confidenceOrZero() {
        if (confidence == null || confidence.isNaN()) {
            return 0.0;
        }
        return Math.clamp(confidence, 0.0, 1.0);
    }

    /**
     * 判断回传的 legend 是否与请求的档位定义一致。
     * 这是校验「模型收到的档位没被打乱」的唯一手段：
     * 数量不符或序号不连续，都说明档位语义可能错位，
     * 此时按索引取到的文字未必对应当前档位，调用方需要降级并提示。
     *
     * @param requestedLevels 请求时提交的档位列表
     * @return true 表示 legend 存在且与请求档位一一对应
     */
    public boolean legendMatches(List<String> requestedLevels) {
        if (requestedLevels == null || requestedLevels.isEmpty() || legend == null || legend.isEmpty()) {
            return false;
        }
        if (legend.size() != requestedLevels.size()) {
            return false;
        }
        for (int index = 0; index < requestedLevels.size(); index += 1) {
            if (!legend.containsKey(String.valueOf(index))) {
                return false;
            }
        }
        return true;
    }

    /**
     * 按序号读取回传的档位文字。
     *
     * @param index 档位序号
     * @return 档位文字，缺失时返回空串
     */
    public String legendAt(int index) {
        if (legend == null) {
            return "";
        }
        return legend.getOrDefault(String.valueOf(index), "");
    }

    /**
     * 归一化可选映射，避免 null 值进入记录。
     *
     * @param source 原始映射
     * @return 不可变映射
     */
    static Map<String, String> copyLegend(Map<String, String> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        // 用不可变视图而不是 Map.copyOf 包装：后者迭代顺序未定义，
        // 会让回传的档位表在日志和报告里以乱序出现，掩盖真正需要发现的档位错位。
        return Collections.unmodifiableMap(new LinkedHashMap<>(source));
    }
}
