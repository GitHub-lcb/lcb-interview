package com.lcbinterview.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Jev 概率打分策略：把 Jev 推算的号码开出概率适配成 {@link LotteryKl8NumberScorer}。
 *
 * 重要边界：本策略的分数是「模型信念」而非「命中能力」。
 * 由于单号真实概率恒为 0.25，本策略默认不允许直接驱动推荐排序——
 * 必须先通过 {@link LotteryKl8JevCalibrationService} 的校准闸门，
 * 由 {@code JevProbabilityScorer} 的开关态控制是否参与融合。
 *
 * 设计上不可用时静默返回空映射，让调用方自然回退到 {@link RuleFactorScorer}，
 * 避免因为外部服务抖动导致整条推荐链路失败。
 */
@Service
public class JevProbabilityScorer implements LotteryKl8NumberScorer {

    private static final Logger log = LoggerFactory.getLogger(JevProbabilityScorer.class);

    /** 策略版本标识。 */
    public static final String VERSION = "JEV_PROBABILITY_V1";

    private final LotteryKl8JevProbabilityService probabilityService;

    /**
     * 创建 Jev 概率打分策略。
     *
     * @param probabilityService Jev 号码概率推算服务
     */
    public JevProbabilityScorer(LotteryKl8JevProbabilityService probabilityService) {
        this.probabilityService = probabilityService;
    }

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
     * 判断 Jev 概率是否获准参与打分。
     * 仅有密钥还不够：必须显式打开 JEV_ALLOW_SCORING，确保概率在通过校准闸门后才影响推荐。
     *
     * @return true 表示可参与打分
     */
    @Override
    public boolean available() {
        return probabilityService.scoringAllowed();
    }

    /**
     * 调用 Jev 推算 80 个号码概率并转换为打分。
     *
     * 除人工闸门 {@code JEV_ALLOW_SCORING} 外，这里还设了一道自动否决：
     * Jev 给出的 80 个概率之和必须对齐「每期只开 20 个号码」这一规则约束。
     * 实测发现模型会把概率整体抬高约 25%-30%（隐含期望开出 25-26 个号码），
     * 此时数值连规则都没对齐，让它们影响推荐等于把系统性偏差引入结果。
     * 因此不满足守恒时直接拒绝并回退规则策略，等模型改进后闸门会自然打开。
     *
     * @param report 历史特征报告
     * @return 号码 -&gt; 开出概率；不可用、调用失败或基率不守恒时返回空映射
     */
    @Override
    public Map<Integer, Double> score(LotteryKl8FeatureReport report) {
        if (report == null || !available()) {
            return Map.of();
        }
        try {
            LotteryKl8JevProbabilityResult result = probabilityService.estimate(report);
            if (!result.baselineConserved()) {
                log.warn("Jev 概率未通过基率守恒否决：隐含期望开出 {} 个号码，规则要求 {} 个，"
                                + "已拒绝参与打分并回退规则策略",
                        result.impliedDrawnCount(), LotteryKl8JevProbabilityResult.DRAWN_PER_ISSUE);
                return Map.of();
            }
            Map<Integer, Double> scores = new LinkedHashMap<>();
            for (LotteryKl8JevNumberProbability item : result.numbers()) {
                scores.put(item.number(), item.probability());
            }
            return scores;
        } catch (RuntimeException e) {
            // 外部决策层故障不能拖垮推荐主链路：记录后回退，让调用方继续使用规则策略
            log.warn("Jev 概率打分失败，已回退规则策略：{}", e.getMessage());
            return Map.of();
        }
    }
}
