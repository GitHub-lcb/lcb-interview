package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Jev 号码概率推算测试。用桩客户端提供确定答案，不发起真实外呼。
 */
class LotteryKl8JevProbabilityServiceTest {

    private static final double DRAWN_PROBABILITY = 0.30;
    private static final double UNDRAWN_PROBABILITY = 0.2333;

    /** 请求提交的中文档位表，Jev 会原样回传，用于校验档位没有错位。 */
    private static final Map<String, String> RISK_LEGEND = Map.of(
            "0", "结构高度均衡：区间、奇偶、尾数分布贴近历史常态",
            "1", "结构较均衡：仅个别维度存在轻微偏移",
            "2", "结构一般：存在可察觉的区间或奇偶集中",
            "3", "结构偏斜：多个维度同时偏离历史常态",
            "4", "结构严重偏斜：极端集中，与历史常态差异显著");

    @Test
    void assemblesProbabilitiesRanksAndDeviationStats() {
        LotteryKl8JevProbabilityService service = service(config(true, false), answers(80));

        LotteryKl8JevProbabilityResult result = service.estimate(report(), 4);

        assertEquals("jev-test-1", result.model());
        assertEquals(0.25, result.baselineProbability(), 0.000001);
        assertEquals(80, result.numbers().size());
        assertEquals(4, result.pickSize());
        // 1-20 抬到 30%、21-80 压到 23.33%，均值仍应贴近基线
        assertEquals(0.25, result.meanProbability(), 0.000001);
        assertEquals(0.025, result.meanAbsoluteDeviation(), 0.000001);
        assertEquals(0.05, result.maxDeviation(), 0.000001);
        assertEquals(1, result.maxDeviationNumber());
        // 概率最高的 4 个号码按升序返回
        assertEquals(List.of(1, 2, 3, 4), result.topNumbers());
        assertEquals(DRAWN_PROBABILITY, probabilityOf(result, 1), 0.000001);
        assertEquals(UNDRAWN_PROBABILITY, probabilityOf(result, 21), 0.000001);
        assertEquals(1, rankOf(result, 1));
        assertEquals(80, rankOf(result, 80));
        assertTrue(result.interpretation().contains("随机基线"), "解读必须点明随机基线，实际：" + result.interpretation());
        assertEquals(3, result.warnings().size());
        assertTrue(result.legendAligned(), "模型回传了完整档位表，应判定为对齐");
    }

    @Test
    void missingLegendIsWarnedAndFlagsMisalignment() {
        Map<String, JevAnswer> answers = answers(80);
        // 上游省略 legend：档位文字无法核对，必须降级并告警，不能静默按索引取文字
        answers.put("structure_risk", riskAnswer(Map.of()));

        LotteryKl8JevProbabilityResult result = service(config(true, false), answers).estimate(report(), 4);

        assertFalse(result.legendAligned());
        assertEquals(4, result.warnings().size());
        assertTrue(result.warnings().stream().anyMatch(text -> text.contains("legend")),
                "档位表缺失必须出现在风险提示中");
        // 档位文字仍按本地中文档位表给出，保证接口文案稳定
        assertEquals("结构一般：存在可察觉的区间或奇偶集中", result.overallRiskLabel());
    }

    @Test
    void legendWithWrongLevelCountIsTreatedAsMisaligned() {
        Map<String, JevAnswer> answers = answers(80);
        // 档位数量与请求不一致，说明档位语义可能整体错位
        answers.put("structure_risk", riskAnswer(Map.of("0", "低", "1", "高")));

        LotteryKl8JevProbabilityResult result = service(config(true, false), answers).estimate(report(), 4);

        assertFalse(result.legendAligned());
        assertEquals(4, result.warnings().size());
    }

    @Test
    void riskScoreMapsToLevelLabel() {
        LotteryKl8JevProbabilityService service = service(config(true, false), answers(80));

        LotteryKl8JevProbabilityResult result = service.estimate(report(), 4);

        assertEquals(1.6, result.overallRiskScore(), 0.000001);
        // 档位位置 1.6 四舍五入到索引 2
        assertEquals("结构一般：存在可察觉的区间或奇偶集中", result.overallRiskLabel());
        assertEquals(0.62, result.overallRiskConfidence(), 0.000001);
        assertEquals(42L, result.latencyMs());
        assertEquals(100L, result.inputTokens());
    }

    @Test
    void missingAnswersFallBackToBaselineAndAreWarned() {
        LotteryKl8JevProbabilityService service = service(config(true, false), answers(79));

        LotteryKl8JevProbabilityResult result = service.estimate(report(), 4);

        // 号码 79 与 80 未返回时按基线退避
        assertEquals(0.25, probabilityOf(result, 80), 0.000001);
        assertTrue(result.warnings().stream().anyMatch(text -> text.contains("未获得 Jev 概率")),
                "缺失号码必须出现在风险提示中");
        assertTrue(result.interpretation().contains("退避"), "解读必须说明退避，实际：" + result.interpretation());
    }

    @Test
    void nullReportIsRejected() {
        LotteryKl8JevProbabilityService service = service(config(true, false), answers(80));

        assertThrows(IllegalArgumentException.class, () -> service.estimate(null, 4));
    }

    @Test
    void unavailableConfigIsRejectedBeforeCalling() {
        LotteryKl8JevProbabilityService service = service(config(false, false), answers(80));

        assertFalse(service.available());
        assertThrows(IllegalStateException.class, () -> service.estimate(report(), 4));
    }

    @Test
    void scoringGateIsIndependentFromAvailability() {
        // 可用但未获准打分：概率能算、不能影响推荐
        LotteryKl8JevProbabilityService usable = service(config(true, false), answers(80));
        assertTrue(usable.available());
        assertFalse(usable.scoringAllowed());

        LotteryKl8JevProbabilityService allowed = service(config(true, true), answers(80));
        assertTrue(allowed.scoringAllowed());
    }

    @Test
    void emptyAnswerSetThrowsInsteadOfFabricatingProbabilities() {
        LotteryKl8JevProbabilityService service = service(config(true, false), Map.of());

        assertThrows(IllegalStateException.class, () -> service.estimate(report(), 4));
    }

    /**
     * 构造服务。
     *
     * @param config  Jev 配置服务
     * @param answers 桩客户端固定返回的答案
     * @return 概率推算服务
     */
    private LotteryKl8JevProbabilityService service(JevRuntimeConfigService config, Map<String, JevAnswer> answers) {
        LotteryKl8JevClient client = new LotteryKl8JevClient(new ObjectMapper(), config, HttpClient.newHttpClient()) {
            @Override
            public JevEvaluation evaluate(Object state, List<JevQuestion> questions) {
                return new JevEvaluation(answers, "jev-test-1", 100L, 0L, 42L);
            }
        };
        return new LotteryKl8JevProbabilityService(client, config);
    }

    /**
     * 构造 Jev 配置服务。
     *
     * @param enabled      是否启用
     * @param allowScoring 是否允许参与打分
     * @return 配置服务
     */
    private JevRuntimeConfigService config(boolean enabled, boolean allowScoring) {
        return new JevRuntimeConfigService(
                enabled, allowScoring, "sk-test", "jev-test-1", "http://localhost/jev", 1000L);
    }

    /**
     * 构造确定性答案集合。
     * 号码 1-20 抬到 30%、21-80 压到 23.33%，均值保持 25%，
     * 用于模拟「具备判别力」的输入以校验统计与排名逻辑。
     *
     * @param count 返回答案的号码数量，从 1 开始
     * @return 答案映射
     */
    private Map<String, JevAnswer> answers(int count) {
        Map<String, JevAnswer> answers = new LinkedHashMap<>();
        for (int number = 1; number <= count; number += 1) {
            double probability = number <= 20 ? DRAWN_PROBABILITY : UNDRAWN_PROBABILITY;
            answers.put("n" + number, new JevAnswer("n" + number, JevQuestion.TYPE_NOUL, probability,
                    null, null, Map.of(), null));
        }
        answers.put("structure_risk", riskAnswer(RISK_LEGEND));
        return answers;
    }

    /**
     * 构造结构风险答案。
     *
     * @param legend 档位文字回传，传空映射模拟上游未回传 legend
     * @return Score 答案
     */
    private JevAnswer riskAnswer(Map<String, String> legend) {
        return new JevAnswer("structure_risk", JevQuestion.TYPE_SCORE, null,
                null, 1.6, Map.of("0", 0.1, "2", 0.5), 0.62, legend);
    }

    /**
     * 构造最小可用特征报告。
     *
     * @return 特征报告
     */
    private LotteryKl8FeatureReport report() {
        return new LotteryKl8FeatureReport(
                200,
                "2026200",
                List.of(1, 2, 3),
                List.of(78, 79, 80),
                Map.of(5, 12, 7, 9),
                Map.of("1-20", 50, "21-40", 50),
                30,
                30,
                List.of(),
                "测试摘要");
    }

    /**
     * 取指定号码的概率。
     *
     * @param result 推算结果
     * @param number 号码
     * @return 概率
     */
    private double probabilityOf(LotteryKl8JevProbabilityResult result, int number) {
        return result.numbers().stream()
                .filter(item -> item.number() == number)
                .findFirst()
                .orElseThrow()
                .probability();
    }

    /**
     * 取指定号码的排名。
     *
     * @param result 推算结果
     * @param number 号码
     * @return 排名
     */
    private int rankOf(LotteryKl8JevProbabilityResult result, int number) {
        return result.numbers().stream()
                .filter(item -> item.number() == number)
                .findFirst()
                .orElseThrow()
                .rank();
    }

    /**
     * 断言结果中不含重复号码。
     *
     * @param result 推算结果
     * @return 去重后的号码数量
     */
    private int distinctNumbers(LotteryKl8JevProbabilityResult result) {
        List<Integer> numbers = new ArrayList<>();
        for (LotteryKl8JevNumberProbability item : result.numbers()) {
            numbers.add(item.number());
        }
        return numbers.stream().distinct().toList().size();
    }

    @Test
    void everyNumberAppearsExactlyOnce() {
        LotteryKl8JevProbabilityService service = service(config(true, false), answers(80));

        LotteryKl8JevProbabilityResult result = service.estimate(report(), 4);

        assertEquals(80, distinctNumbers(result));
    }
}
