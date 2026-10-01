package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8AuditReportVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 真实开奖数据审计一致性测试。
 * <p>
 * 目的：把 Java 实现的审计结果与 Python 验算脚本（scipy 独立计算）在同一份真实数据上的结果对齐。
 * 两套实现语言不同、算法路径不同，结果必须一致——否则说明其中之一有 bug，
 * 而这个审计是「无法预测」这一结论的唯一支撑，不能有实现层面的不确定性。
 * <p>
 * 数据文件 {@code docs/superpowers/scripts/kl8-probability/real_draws.csv}
 * 为 2073 期中彩网真实开奖。不存在该文件时跳过，不让本地缺文件影响构建。
 */
class LotteryKl8RandomnessAuditRealDataTest {

    private static final Path REAL_DRAWS = Path.of("..", "docs", "superpowers", "scripts",
            "kl8-probability", "real_draws.csv");

    /**
     * 读取真实开奖 CSV（期号,日期,空格分隔号码）。
     *
     * @return 按期号升序排列的开奖记录
     * @throws Exception 读取失败时抛出
     */
    private List<LotteryKl8Draw> loadRealDraws() throws Exception {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(REAL_DRAWS, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split(",");
                if (parts.length < 3) {
                    continue;
                }
                LotteryKl8Draw draw = new LotteryKl8Draw();
                draw.setIssueNo(parts[0].trim());
                draw.setNumbers(parts[2].trim().replace(' ', ','));
                draws.add(draw);
            }
        }
        return draws;
    }

    private LotteryKl8AuditReportVO runAudit(List<LotteryKl8Draw> draws) {
        LotteryKl8DrawMapper mapper = Mockito.mock(LotteryKl8DrawMapper.class);
        Mockito.when(mapper.selectList(ArgumentMatchers.any()))
                .thenAnswer(invocation -> new ArrayList<>(draws));
        return new LotteryKl8RandomnessAuditService(mapper).audit(0);
    }

    @Test
    @DisplayName("真实 2073 期开奖的审计结果必须复现 Python/scipy 独立验算值")
    void auditMatchesIndependentPythonVerification() throws Exception {
        if (!Files.exists(REAL_DRAWS)) {
            System.out.println("跳过：未找到真实开奖数据 " + REAL_DRAWS.toAbsolutePath());
            return;
        }
        List<LotteryKl8Draw> draws = loadRealDraws();
        assertEquals(2073, draws.size(), "真实开奖应为 2073 期");

        LotteryKl8AuditReportVO report = runAudit(draws);

        assertEquals(2073, report.issueCount());
        assertTrue(report.invalidNumberCounts().isEmpty(),
                "真实数据每期应恰好 20 个号码，实际异常: " + report.invalidNumberCounts());
        assertTrue(report.checkCount() > 80, "检验项数应超过 80，实际 " + report.checkCount());

        LotteryKl8AuditCheckResult frequency = report.checks().stream()
                .filter(check -> check.name().equals("卡方拟合优度"))
                .findFirst()
                .orElse(null);
        assertNotNull(frequency, "应包含 80 号频次卡方检验");
        // Python/scipy 独立验算：χ²=57.21, df=79, p=0.9693
        assertEquals(57.21, frequency.statistic(), 0.05,
                "卡方统计量应与 Python 验算的 57.21 一致");
        assertEquals(0.9693, frequency.pValue(), 5e-4,
                "卡方 p 值应与 Python 验算的 0.9693 一致");
        assertEquals(79, frequency.degreesOfFreedom(), "自由度应为 79");

        LotteryKl8AuditCheckResult overlap = report.checks().stream()
                .filter(check -> check.name().equals("相邻两期重号数"))
                .findFirst()
                .orElse(null);
        assertNotNull(overlap, "应包含重号数检验");
        // Python 验算：观测 4.9990，期望 5.0000，z=-0.026，p=0.9792
        assertEquals(-0.026, overlap.statistic(), 0.02,
                "重号数 z 值应与 Python 验算的 -0.026 一致");
        assertTrue(overlap.pValue() > 0.9,
                "重号数 p 值应接近 1，实际 " + overlap.pValue());

        // 核心结论：真实数据不存在可利用偏差
        assertEquals(0, report.correctedSignificantCount(),
                "真实开奖通过 Bonferroni 校正的显著项应为 0，实际: "
                        + report.checks().stream()
                        .filter(check -> check.pValue() < report.bonferroniThreshold())
                        .map(check -> check.name() + "(p=" + check.pValue() + ")")
                        .toList());
        assertTrue(report.conclusion().contains("未发现"),
                "结论应为未发现偏差，实际: " + report.conclusion());
        assertTrue(report.conclusion().contains("期望贡献恒为 0"),
                "结论必须点明未发现偏差不等于可预测，实际: " + report.conclusion());

        System.out.println("=== real data audit summary ===");
        System.out.println("checks=" + report.checkCount()
                + ", bonferroniThreshold=" + report.bonferroniThreshold());
        // 用 ASCII 标签而非 χ²：Windows 控制台默认 GBK，重定向时会把非 ASCII 字符损坏
        System.out.println("frequency chi-square: chi2=" + frequency.statistic()
                + ", df=" + frequency.degreesOfFreedom()
                + ", p=" + frequency.pValue());
        System.out.println("adjacent overlap: z=" + overlap.statistic()
                + ", p=" + overlap.pValue());
        report.checks().stream()
                .filter(check -> check.name().startsWith("间隔") || check.name().startsWith("每期和值")
                        || check.name().startsWith("奇数") || check.name().startsWith("KS"))
                .forEach(check -> System.out.println(check.name() + ": statistic="
                        + String.format("%.4f", check.statistic()) + ", p=" + String.format("%.4f", check.pValue())));
    }
}
