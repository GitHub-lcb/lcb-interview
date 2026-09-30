package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Jev 概率打分策略测试。
 * 重点是三条防线：人工闸门未打开时不得打分；基率不守恒时不得打分；外部决策层故障时不得拖垮主链路。
 */
class JevProbabilityScorerTest {

    @Test
    void refusesToScoreWhenGateIsClosed() {
        JevProbabilityScorer scorer = new JevProbabilityScorer(stub(false, false));

        assertFalse(scorer.available(), "闸门未打开时不应可用");
        assertTrue(scorer.score(report()).isEmpty(), "闸门未打开时必须返回空映射");
        assertEquals(JevProbabilityScorer.VERSION, scorer.version());
    }

    @Test
    void returnsProbabilitiesWhenGateIsOpen() {
        JevProbabilityScorer scorer = new JevProbabilityScorer(stub(true, false));

        assertTrue(scorer.available());
        Map<Integer, Double> scores = scorer.score(report());

        assertEquals(2, scores.size());
        assertEquals(0.31, scores.get(1), 0.000001);
        assertEquals(0.19, scores.get(2), 0.000001);
    }

    @Test
    void vetoesScoringWhenBaselineIsNotConserved() {
        // 真实调用实测到的形态：80 个概率之和约 26，隐含每期开出 26 个号码，而规则只开 20 个。
        // 这种输出连游戏规则都没对齐，让它们影响推荐等于把系统性偏差引进结果。
        JevProbabilityScorer scorer = new JevProbabilityScorer(stub(true, false, 26.13));

        assertTrue(scorer.available(), "自动否决不影响可用性，可用性只看人工闸门");
        assertTrue(scorer.score(report()).isEmpty(),
                "基率不守恒时必须回退规则策略，不得用失真的概率打分");
    }

    @Test
    void degradesToEmptyMapOnUpstreamFailure() {
        JevProbabilityScorer scorer = new JevProbabilityScorer(stub(true, true));

        assertTrue(scorer.available(), "可用性只看配置，不因单次故障改变");
        assertTrue(scorer.score(report()).isEmpty(), "上游故障必须静默回退，不抛异常");
    }

    @Test
    void nullReportIsRejected() {
        JevProbabilityScorer scorer = new JevProbabilityScorer(stub(true, false));

        assertTrue(scorer.score(null).isEmpty());
    }

    /**
     * 构造桩概率服务，隐含开出号码数默认满足基率守恒。
     *
     * @param scoringAllowed   闸门状态
     * @param throwsOnEstimate 是否模拟外部故障
     * @return 概率服务
     */
    private LotteryKl8JevProbabilityService stub(boolean scoringAllowed, boolean throwsOnEstimate) {
        return stub(scoringAllowed, throwsOnEstimate, 20.0);
    }

    /**
     * 构造桩概率服务。
     *
     * @param scoringAllowed    闸门状态
     * @param throwsOnEstimate  是否模拟外部故障
     * @param impliedDrawnCount 隐含期望开出号码数，用于控制基率是否守恒
     * @return 概率服务
     */
    private LotteryKl8JevProbabilityService stub(
            boolean scoringAllowed, boolean throwsOnEstimate, double impliedDrawnCount) {
        JevRuntimeConfigService config = new JevRuntimeConfigService(
                true, scoringAllowed, "sk-test", "jev-test-1", "http://localhost/jev", 1000L);
        LotteryKl8JevClient client = new LotteryKl8JevClient(
                new ObjectMapper(), config, HttpClient.newHttpClient());
        return new LotteryKl8JevProbabilityService(client, config) {
            @Override
            public boolean scoringAllowed() {
                return scoringAllowed;
            }

            @Override
            public LotteryKl8JevProbabilityResult estimate(LotteryKl8FeatureReport report, int pickSize) {
                if (throwsOnEstimate) {
                    throw new IllegalStateException("模拟外部决策层故障");
                }
                return result(impliedDrawnCount);
            }
        };
    }

    /**
     * 构造最小概率结果。
     *
     * @param impliedDrawnCount 隐含期望开出号码数
     * @return 概率推算结果
     */
    private LotteryKl8JevProbabilityResult result(double impliedDrawnCount) {
        return new LotteryKl8JevProbabilityResult(
                "jev-test-1",
                0.25,
                List.of(
                        new LotteryKl8JevNumberProbability(1, 0.31, 0.06, 1),
                        new LotteryKl8JevNumberProbability(2, 0.19, -0.06, 80)),
                List.of(1),
                1,
                0.25,
                impliedDrawnCount,
                0.06,
                0.06,
                1,
                1,
                1.0,
                "结构较均衡：仅个别维度存在轻微偏移",
                0.5,
                true,
                10L,
                100L,
                0L,
                "测试解读",
                List.of("测试提示"));
    }

    /**
     * 构造最小特征报告。
     *
     * @return 特征报告
     */
    private LotteryKl8FeatureReport report() {
        return new LotteryKl8FeatureReport(
                200, "2026200", List.of(1), List.of(80), Map.of(), Map.of("1-20", 10), 5, 5, List.of(), "摘要");
    }
}
