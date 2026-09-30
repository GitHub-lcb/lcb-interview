package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Jev 校准闸门端到端测试。
 * 用桩数据验证「Brier 差值 → 配对检验 → 放行/拒绝」这条判定链是否真的能区分信号与噪声。
 */
class LotteryKl8JevCalibrationServiceTest {

    /** 20 个实际开出的号码，均值恒为 25%。 */
    private static final List<Integer> DRAWN_NUMBERS = IntStream.rangeClosed(1, 20).boxed().toList();

    @Test
    void passesGateWhenProbabilitiesDiscriminate() {
        // 把开出号码抬到 30%、未开出压到 23.33%，模拟「具备真实判别力」的输入
        LotteryKl8JevCalibrationReport report = run(probabilities(0.30, 0.2333));

        assertEquals(2, report.issuesEvaluated());
        assertEquals(160, report.pairsEvaluated());
        assertEquals(20, report.baseIssueCount());
        assertEquals(0.25, report.meanJevProbability(), 0.0005);
        assertEquals(0.25, report.observedHitRate(), 0.0005);
        assertEquals(0.1875, report.brierBaseline(), 0.0005);
        // 具备判别力时的 Brier 差值约 -0.0242，与文档给出的参考量级一致
        assertEquals(-0.0242, report.brierDelta(), 0.0005);
        assertTrue(report.passedGate(), "稳定且幅度足够的判别力必须放行，实际结论：" + report.verdict());
        assertTrue(report.verdict().contains("闸门放行"));
        assertEquals(List.of("jev-test-1"), report.modelVersions());
    }

    @Test
    void rejectsGateWhenProbabilitiesEqualBaseline() {
        // 概率恒等于 25% 基线：Brier 差值为 0，不构成任何证据
        LotteryKl8JevCalibrationReport report = run(probabilities(0.25, 0.25));

        assertEquals(0.0, report.brierDelta(), 0.0005);
        assertFalse(report.passedGate(), "无判别力时不得放行");
        assertTrue(report.verdict().contains("未发现 Jev 概率优于随机基线"),
                "结论必须直说没有证据，实际：" + report.verdict());
        assertTrue(report.warnings().stream().anyMatch(text -> text.contains("闸门未放行")));
    }

    @Test
    void rejectsGateWhenProbabilitiesAreWorseThanBaseline() {
        // 过度自信：60 个未开出号码被抬到 35%，Brier 会劣于常数基线
        LotteryKl8JevCalibrationReport report = run(probabilities(0.20, 0.35));

        assertTrue(report.brierDelta() > 0, "过度自信必须体现在更差的 Brier 上，实际 " + report.brierDelta());
        assertFalse(report.passedGate());
        assertTrue(report.warnings().stream().anyMatch(text -> text.contains("过度自信")));
    }

    /**
     * 搭建桩环境并运行校准。
     *
     * @param result 桩概率服务返回的结果
     * @return 校准报告
     */
    private LotteryKl8JevCalibrationReport run(LotteryKl8JevProbabilityResult result) {
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8FeatureService featureService = mock(LotteryKl8FeatureService.class);
        LotteryKl8JevProbabilityService probabilityService = mock(LotteryKl8JevProbabilityService.class);
        JevRuntimeConfigService config = new JevRuntimeConfigService(
                true, false, "sk-test", "jev-test-1", "http://localhost/jev", 1000L);

        when(drawMapper.selectList(any(Wrapper.class))).thenReturn(drawHistory(22));
        when(featureService.parseNumbers(anyString())).thenReturn(DRAWN_NUMBERS);
        when(featureService.buildReportFromDraws(any(), any(), anyInt(), any())).thenReturn(minimalReport());
        when(probabilityService.available()).thenReturn(true);
        when(probabilityService.estimate(any(), anyInt())).thenReturn(result);

        LotteryKl8JevCalibrationService service = new LotteryKl8JevCalibrationService(
                drawMapper, featureService, probabilityService, config);
        return service.calibrate(2, 20, 4);
    }

    /**
     * 构造开奖历史，号码固定为 1-20。
     *
     * @param count 期数
     * @return 开奖记录，最新在前
     */
    private List<LotteryKl8Draw> drawHistory(int count) {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        String numbers = String.join(",", DRAWN_NUMBERS.stream().map(String::valueOf).toList());
        for (int index = 0; index < count; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo("2026%03d".formatted(count - index));
            draw.setDrawDate(LocalDate.of(2026, 1, 1).plusDays(count - index));
            draw.setNumbers(numbers);
            draws.add(draw);
        }
        return draws;
    }

    /**
     * 构造桩概率结果。前 20 个号码使用第一个概率，其余使用第二个。
     *
     * @param drawnProbability   开出号码的概率
     * @param undrawnProbability 未开出号码的概率
     * @return 概率结果
     */
    private LotteryKl8JevProbabilityResult probabilities(double drawnProbability, double undrawnProbability) {
        List<LotteryKl8JevNumberProbability> numbers = new ArrayList<>();
        double sum = 0;
        int aboveBaseline = 0;
        for (int number = 1; number <= 80; number += 1) {
            double probability = number <= 20 ? drawnProbability : undrawnProbability;
            sum += probability;
            if (probability > 0.25) {
                aboveBaseline += 1;
            }
            numbers.add(new LotteryKl8JevNumberProbability(
                    number, probability, probability - 0.25, number));
        }
        return new LotteryKl8JevProbabilityResult(
                "jev-test-1", 0.25, List.copyOf(numbers), List.of(1, 2, 3, 4), 4,
                0.25, sum, 0.02, 0.05, 1,
                aboveBaseline,
                1.0, "结构较均衡：仅个别维度存在轻微偏移", 0.5, true,
                10L, 100L, 0L, "测试解读", List.of("测试提示"));
    }

    /**
     * 构造最小特征报告，特征服务已被打桩，内容不参与断言。
     *
     * @return 特征报告
     */
    private LotteryKl8FeatureReport minimalReport() {
        return new LotteryKl8FeatureReport(
                20, "2026021", List.of(1), List.of(80), Map.of(), Map.of("1-20", 10), 5, 5, List.of(), "摘要");
    }
}
