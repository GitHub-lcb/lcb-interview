package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 规则因子打分策略测试：该适配器必须与既有 compositeScore 完全一致，不得改变推荐行为。
 */
class RuleFactorScorerTest {

    private final RuleFactorScorer scorer = new RuleFactorScorer();

    @Test
    void exposesStableVersionAndIsAlwaysAvailable() {
        assertEquals(RuleFactorScorer.VERSION, scorer.version());
        assertTrue(scorer.available(), "规则策略不依赖外部服务，必须始终可用");
    }

    @Test
    void returnsCompositeScoreWithoutRecomputing() {
        Map<Integer, Double> scores = scorer.score(reportWithProfiles());

        assertEquals(2, scores.size());
        assertEquals(7.5, scores.get(1), 0.000001);
        assertEquals(3.25, scores.get(2), 0.000001);
    }

    @Test
    void handlesMissingInputGracefully() {
        assertTrue(scorer.score(null).isEmpty());
        // 简化构造的报告没有号码画像，应返回空映射而不是抛错
        LotteryKl8FeatureReport plain = new LotteryKl8FeatureReport(
                200, "2026200", List.of(1), List.of(80), Map.of(), Map.of("1-20", 10), 5, 5, List.of(), "摘要");
        assertTrue(scorer.score(plain).isEmpty());
    }

    /**
     * 构造带号码画像的特征报告。
     *
     * @return 特征报告
     */
    private LotteryKl8FeatureReport reportWithProfiles() {
        return new LotteryKl8FeatureReport(
                200,
                "2026200",
                List.of(1),
                List.of(80),
                Map.of(1, 0),
                Map.of("1-20", 10),
                Map.of("尾1", 5),
                Map.of("模1", 5),
                10,
                10,
                List.of(),
                List.of(profile(1, 7.5), profile(2, 3.25)),
                List.of(),
                List.of(),
                LotteryKl8BacktestSummary.empty(),
                LotteryKl8OptimizedPortfolio.empty(),
                List.of(),
                "摘要",
                "深度摘要");
    }

    /**
     * 构造号码画像。
     *
     * @param number         号码
     * @param compositeScore 综合分
     * @return 号码画像
     */
    private LotteryKl8NumberProfile profile(int number, double compositeScore) {
        return new LotteryKl8NumberProfile(
                number, 50, 0.25, 8, 15, 30, 90, 3, 3.5, 12,
                0.1, 0.2, 0.3, 0.4, "1-20", "奇", number % 10, number % 10,
                compositeScore, List.of("热号"));
    }
}
