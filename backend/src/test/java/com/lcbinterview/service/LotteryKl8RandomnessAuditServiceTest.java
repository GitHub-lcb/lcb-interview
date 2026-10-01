package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8AuditReportVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 随机性审计服务测试。
 * <p>
 * 核心验证：用真实开奖特征构造的数据不应报出强显著偏差；
 * 人为注入偏差时必须被检出。这两条缺一不可——只测前者会导致「审计根本不工作」
 * 也显示通过，只测后者则无法证明真实数据确实干净。
 */
class LotteryKl8RandomnessAuditServiceTest {

    private static final int PICK = 20;
    private static final int POPULATION = 80;

    /**
     * 构造符合快乐8 规则的随机开奖：每期从 80 个号中不放回抽 20 个。
     */
    private List<LotteryKl8Draw> randomDraws(int count, long seed) {
        Random random = new Random(seed);
        List<LotteryKl8Draw> draws = new ArrayList<>(count);
        for (int index = 0; index < count; index += 1) {
            boolean[] chosen = new boolean[POPULATION + 1];
            StringBuilder numbers = new StringBuilder();
            for (int pick = 0; pick < PICK; pick += 1) {
                int number;
                do {
                    number = random.nextInt(POPULATION) + 1;
                } while (chosen[number]);
                chosen[number] = true;
                if (numbers.length() > 0) {
                    numbers.append(',');
                }
                numbers.append(number);
            }
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo(String.format("2026%04d", index + 1));
            draw.setNumbers(numbers.toString());
            draws.add(draw);
        }
        return draws;
    }

    private LotteryKl8RandomnessAuditService serviceOf(List<LotteryKl8Draw> draws) {
        LotteryKl8DrawMapper mapper = org.mockito.Mockito.mock(LotteryKl8DrawMapper.class);
        org.mockito.Mockito.when(mapper.selectList(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> new ArrayList<>(draws));
        return new LotteryKl8RandomnessAuditService(mapper);
    }

    @Test
    @DisplayName("规则合规的随机开奖不应报出任何通过多重比较校正的偏差")
    void cleanRandomDataPassesAudit() {
        LotteryKl8AuditReportVO report = serviceOf(randomDraws(600, 20260930L)).audit(600);

        assertNotNull(report);
        assertEquals(600, report.issueCount());
        assertTrue(report.invalidNumberCounts().isEmpty(), "号码个数应全部为 20");
        assertTrue(report.checkCount() > 80);
        assertEquals(report.checkCount(), report.checks().size());

        // 本次审计同时跑 90+ 项检验（其中 80 项是逐号码游程检验）。
        // 91 项检验下，纯随机出现至少一项 p<0.01 的概率高达 60%，
        // 因此判据必须用 Bonferroni 阈值 0.05/N，而不是名义 5% 或 1%。
        assertEquals(0, report.correctedSignificantCount(),
                "干净数据不应有通过 Bonferroni 校正的检验项，实际: " + correctedChecks(report));
        assertTrue(report.bonferroniThreshold() > 0 && report.bonferroniThreshold() < 0.001,
                "Bonferroni 阈值应约为 0.05/91 = 0.00055，实际 " + report.bonferroniThreshold());

        LotteryKl8AuditCheckResult frequency = report.checks().stream()
                .filter(check -> check.name().equals("卡方拟合优度"))
                .findFirst()
                .orElse(null);
        assertNotNull(frequency, "应包含 80 号频次卡方检验");
        assertFalse(frequency.significant(),
                "规则合规数据下号码频次必须均匀，实际 p=" + frequency.pValue());

        assertTrue(report.conclusion().contains("未发现"),
                "结论应说明未发现偏差，实际: " + report.conclusion());
        assertTrue(report.conclusion().contains("期望贡献恒为 0"),
                "结论必须点明未发现偏差不等于可预测，实际: " + report.conclusion());
    }

    @Test
    @DisplayName("审计必须覆盖号码频次、重号、和值、奇偶、区间与序列相关性")
    void auditCoversAllDimensions() {
        LotteryKl8AuditReportVO report = serviceOf(randomDraws(300, 7L)).audit(300);

        List<String> names = report.checks().stream().map(LotteryKl8AuditCheckResult::name).toList();
        assertTrue(names.contains("卡方拟合优度"), "应检验 80 号频次均匀性");
        assertTrue(names.contains("相邻两期重号数"), "应检验相邻期是否独立");
        assertTrue(names.contains("每期和值均值"), "应检验和值是否有物理偏差");
        assertTrue(names.contains("奇数号占比"), "应检验奇偶分布");
        assertTrue(names.contains("KS 均匀性检验"), "应检验号码位置分布");
        assertTrue(names.stream().anyMatch(name -> name.startsWith("间隔")), "应检验序列相关性");
        for (int lag = 1; lag <= 5; lag += 1) {
            assertTrue(names.contains("间隔 " + lag + " 期的重号自相关"),
                    "应有间隔 " + lag + " 阶的自相关检验，实际: " + names);
        }
        assertTrue(names.stream().anyMatch(name -> name.startsWith("游程检验")), "应检验单号惯性");
        // 80 个号码各做一次游程检验
        long runsChecks = names.stream().filter(name -> name.startsWith("游程检验")).count();
        assertEquals(POPULATION, runsChecks, "每个号码都应单独做游程检验");
    }

    @Test
    @DisplayName("号码个数不为 20 时必须报数据质量问题，而不是继续输出统计量")
    void invalidNumberCountsAreFlagged() {
        List<LotteryKl8Draw> draws = randomDraws(300, 11L);
        // 把第 5 期的号码改成 19 个，模拟抓取错位
        LotteryKl8Draw broken = draws.get(4);
        String[] parts = broken.getNumbers().split(",");
        StringBuilder shortened = new StringBuilder();
        for (int index = 0; index < parts.length - 1; index += 1) {
            if (shortened.length() > 0) {
                shortened.append(',');
            }
            shortened.append(parts[index]);
        }
        broken.setNumbers(shortened.toString());

        LotteryKl8AuditReportVO report = serviceOf(draws).audit(300);

        assertEquals(1, report.invalidNumberCounts().size(),
                "应识别出 1 期号码个数异常");
        assertEquals(19, report.invalidNumberCounts().getFirst());
        assertTrue(report.conclusion().contains("数据质量检查未通过"),
                "结论应优先提示数据质量问题，实际: " + report.conclusion());
    }

    @Test
    @DisplayName("人为注入的号码偏斜必须被检出")
    void injectedBiasIsDetected() {
        List<LotteryKl8Draw> draws = randomDraws(800, 3L);
        // 改造数据：号码 1~20 更容易被抽中，制造约 6% 的整体偏斜
        Random random = new Random(99);
        for (LotteryKl8Draw draw : draws) {
            boolean[] chosen = new boolean[POPULATION + 1];
            StringBuilder numbers = new StringBuilder();
            int picked = 0;
            while (picked < PICK) {
                int number;
                // 80% 概率从 1~20 抽，20% 概率从 21~80 抽
                number = random.nextInt(10) < 8
                        ? random.nextInt(20) + 1
                        : random.nextInt(60) + 21;
                if (chosen[number]) {
                    continue;
                }
                chosen[number] = true;
                if (numbers.length() > 0) {
                    numbers.append(',');
                }
                numbers.append(number);
                picked += 1;
            }
            draw.setNumbers(numbers.toString());
        }

        LotteryKl8AuditReportVO report = serviceOf(draws).audit(800);

        assertTrue(report.correctedSignificantCount() > 0,
                "6% 的整体号码偏斜必须通过 Bonferroni 校正检出");
        assertTrue(report.conclusion().contains("Bonferroni"),
                "结论应提示通过校正的偏差，实际: " + report.conclusion());
    }

    @Test
    @DisplayName("人为注入的奇偶失衡必须被检出")
    void injectedOddEvenBiasIsDetected() {
        List<LotteryKl8Draw> draws = randomDraws(800, 5L);
        Random random = new Random(123);
        for (LotteryKl8Draw draw : draws) {
            boolean[] chosen = new boolean[POPULATION + 1];
            // 精确构造「15 个奇数 + 5 个偶数」，而不是给奇数设上限：
            // 1~80 中有 40 个奇数，随机抽 20 个通常已有约 10 个奇数，只设上限根本触发不了偏斜。
            List<Integer> odds = shuffledNumbers(40, 1, 2, random, 15);
            List<Integer> evens = shuffledNumbers(40, 2, 2, random, 5);
            StringBuilder numbers = new StringBuilder();
            for (int number : odds) {
                if (numbers.length() > 0) {
                    numbers.append(',');
                }
                numbers.append(number);
            }
            for (int number : evens) {
                numbers.append(',').append(number);
            }
            draw.setNumbers(numbers.toString());
        }

        LotteryKl8AuditReportVO report = serviceOf(draws).audit(800);

        LotteryKl8AuditCheckResult oddEven = report.checks().stream()
                .filter(check -> check.name().equals("奇数号占比"))
                .findFirst()
                .orElse(null);
        assertNotNull(oddEven, "应包含奇偶检验项");
        // 理论期望 50%，实际 75%，800 期 × 20 个样本，偏差远超显著阈值
        assertTrue(oddEven.pValue() < 1e-10,
                "奇数固定 15/20 的强失衡必须被检出，p=" + oddEven.pValue());
    }

    /**
     * 从一个奇偶序列中等概率抽取指定个数的不重复号码。
     *
     * @param count        该奇偶类号码的总数
     * @param start        起始号码（奇数为 1、偶数为 2）
     * @param step         号码步长
     * @param random       随机源
     * @param wantedCount  需要的个数
     * @return 号码列表
     */
    private List<Integer> shuffledNumbers(int count, int start, int step, Random random, int wantedCount) {
        List<Integer> pool = new ArrayList<>(count);
        for (int index = 0; index < count; index += 1) {
            pool.add(start + index * step);
        }
        java.util.Collections.shuffle(pool, random);
        return new ArrayList<>(pool.subList(0, wantedCount));
    }

    @Test
    @DisplayName("人为注入的相邻期相关必须被重号数检验检出")
    void injectedPeriodCorrelationIsDetected() {
        List<LotteryKl8Draw> draws = randomDraws(600, 17L);
        Random random = new Random(31);
        boolean[] previous = null;
        for (LotteryKl8Draw draw : draws) {
            boolean[] chosen = new boolean[POPULATION + 1];
            // 强行让本期保留上期的 10 个号，构造远高于期望 5 个的重号数
            if (previous != null) {
                for (int number = 1; number <= POPULATION; number += 1) {
                    if (previous[number]) {
                        chosen[number] = true;
                    }
                }
            }
            StringBuilder numbers = new StringBuilder();
            int kept = 0;
            for (int number = 1; number <= POPULATION; number += 1) {
                if (chosen[number]) {
                    kept += 1;
                    if (numbers.length() > 0) {
                        numbers.append(',');
                    }
                    numbers.append(number);
                }
            }
            for (int picked = kept; picked < PICK; picked += 1) {
                int number = random.nextInt(POPULATION) + 1;
                if (chosen[number]) {
                    continue;
                }
                chosen[number] = true;
                if (numbers.length() > 0) {
                    numbers.append(',');
                }
                numbers.append(number);
            }
            draw.setNumbers(numbers.toString());
            previous = chosen;
        }

        LotteryKl8AuditReportVO report = serviceOf(draws).audit(600);

        LotteryKl8AuditCheckResult overlap = report.checks().stream()
                .filter(check -> check.name().equals("相邻两期重号数"))
                .findFirst()
                .orElse(null);
        assertNotNull(overlap, "应包含重号数检验项");
        assertTrue(overlap.significant(),
                "强行保留上期 10 个号必须被检出，p=" + overlap.pValue());
        assertTrue(overlap.conclusion().contains("偏离"),
                "结论文案应提示偏离，实际: " + overlap.conclusion());
    }

    @Test
    @DisplayName("期数超范围时按默认口径钳制，不会因参数异常而失败")
    void issueCountIsClamped() {
        LotteryKl8RandomnessAuditService service = serviceOf(randomDraws(200, 5L));
        assertEquals(200, service.audit(0).issueCount(), "非正数应回退默认并按实际可用期数统计");
        assertEquals(200, service.audit(-50).issueCount());
        assertEquals(200, service.audit(99999).issueCount(), "超上限应按实际可用期数统计");
    }

    private String correctedChecks(LotteryKl8AuditReportVO report) {
        return report.checks().stream()
                .filter(check -> check.pValue() < report.bonferroniThreshold())
                .map(check -> check.name() + "(p=" + check.pValue() + ")")
                .toList()
                .toString();
    }
}
