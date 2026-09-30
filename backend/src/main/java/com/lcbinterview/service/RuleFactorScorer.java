package com.lcbinterview.service;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 规则因子打分策略：把现有 6 因子算法的输出适配成 {@link LotteryKl8NumberScorer}。
 *
 * 实现刻意保持零副作用——直接读取 {@link LotteryKl8FeatureReport#numberProfiles()} 上
 * 已经算好的 {@code compositeScore}，不重算、不改参、不再做一次特征工程，
 * 因此接入本接口不会改变任何既有推荐结果。
 */
@Service
public class RuleFactorScorer implements LotteryKl8NumberScorer {

    /** 策略版本标识，与现有推荐记录口径一致。 */
    public static final String VERSION = "RULE_FACTOR_V1";

    /**
     * 返回策略版本。
     *
     * @return 版本标识
     */
    @Override
    public String version() {
        return VERSION;
    }

    /**
     * 规则策略永远可用：不依赖任何外部服务。
     *
     * @return 恒为 true
     */
    @Override
    public boolean available() {
        return true;
    }

    /**
     * 直接取号码画像上的综合分作为打分结果。
     *
     * @param report 历史特征报告
     * @return 号码 -&gt; 综合分；画像缺失时返回空映射
     */
    @Override
    public Map<Integer, Double> score(LotteryKl8FeatureReport report) {
        Map<Integer, Double> scores = new LinkedHashMap<>();
        if (report == null) {
            return scores;
        }
        for (LotteryKl8NumberProfile profile : report.numberProfiles()) {
            scores.put(profile.number(), profile.compositeScore());
        }
        return scores;
    }
}
