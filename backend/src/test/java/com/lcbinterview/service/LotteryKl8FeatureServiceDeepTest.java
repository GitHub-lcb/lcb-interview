package com.lcbinterview.service;

import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LotteryKl8FeatureServiceDeepTest {

    @Test
    void buildsDeepNumberProfilesAndCandidatePool() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any())).thenReturn(sampleDraws());
        LotteryKl8FeatureService service = new LotteryKl8FeatureService(mapper);

        LotteryKl8FeatureReport report = service.buildReport(60);

        assertEquals(80, report.numberProfiles().size());
        assertTrue(report.candidatePool().size() >= 20);
        assertFalse(report.pairHighlights().isEmpty());
        assertFalse(report.analysisSections().isEmpty());

        LotteryKl8NumberProfile hotProfile = report.numberProfiles().stream()
                .filter(profile -> profile.number() == 1)
                .findFirst()
                .orElseThrow();
        LotteryKl8NumberProfile missingProfile = report.numberProfiles().stream()
                .filter(profile -> profile.number() == 80)
                .findFirst()
                .orElseThrow();

        assertTrue(hotProfile.frequency() > missingProfile.frequency());
        assertTrue(hotProfile.recent120Frequency() >= hotProfile.recent60Frequency());
        assertTrue(hotProfile.recent365Frequency() >= hotProfile.recent120Frequency());
        assertTrue(hotProfile.decayedFrequencyScore() > 0);
        assertTrue(hotProfile.omissionPressureScore() >= 0);
        assertTrue(hotProfile.compositeScore() > 0);
        assertTrue(hotProfile.tags().contains("热号"));
        assertTrue(missingProfile.currentMissing() >= 20);
        assertTrue(missingProfile.tags().contains("高遗漏"));
        assertNotNull(report.backtestSummary());
        assertTrue(report.backtestSummary().evaluatedIssueCount() > 0);
        assertTrue(report.backtestSummary().averageHitCount() > 0);
        assertTrue(report.backtestSummary().hitDistribution().values().stream().mapToInt(Integer::intValue).sum() > 0);
        assertTrue(report.backtestSummary().factorWeights().decayWeight() >= report.backtestSummary().factorWeights().missingWeight());
        assertNotNull(report.optimizedPortfolio());
        assertEquals(1, report.optimizedPortfolio().groups().size());
        assertTrue(report.optimizedPortfolio().groups().stream().allMatch(group -> group.numbers().size() == 5));
        assertTrue(report.optimizedPortfolio().summary().contains("组合"));
        assertNotNull(report.deepSummary());
        assertTrue(report.deepSummary().contains("候选池"));
    }

    @Test
    void appliesCalibrationToMissingNumberScore() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any())).thenReturn(sampleDraws());
        LotteryKl8FeatureService service = new LotteryKl8FeatureService(mapper);

        LotteryKl8FeatureReport neutral = service.buildReport(60, LotteryKl8StrategyCalibration.neutral());
        LotteryKl8FeatureReport weighted = service.buildReport(60, new LotteryKl8StrategyCalibration(
                1.0,
                1.0,
                1.8,
                1.0,
                1.0,
                8,
                "测试提高高遗漏权重"));

        double neutralMissingScore = profile(neutral, 80).compositeScore();
        double weightedMissingScore = profile(weighted, 80).compositeScore();

        assertTrue(weightedMissingScore > neutralMissingScore);
        assertTrue(weighted.deepSummary().contains("测试提高高遗漏权重"));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void requestsDeeperHistoryWhenBaseIssueCountAboveFormerCap() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any())).thenReturn(sampleDraws(1200));
        LotteryKl8FeatureService service = new LotteryKl8FeatureService(mapper);

        service.buildReport(1200);

        ArgumentCaptor<Wrapper> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(mapper).selectList(captor.capture());
        assertTrue(lastSql(captor.getValue()).contains("LIMIT 1200"));
    }

    @Test
    void prioritizesDominantBacktestedNumbersInSingleGroup() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any())).thenReturn(dominantSignalDraws());
        LotteryKl8FeatureService service = new LotteryKl8FeatureService(mapper);

        LotteryKl8FeatureReport report = service.buildReport(90);

        List<Integer> dominantNumbers = List.of(1, 2, 3, 4, 5);
        List<Integer> selected = report.optimizedPortfolio().groups().get(0).numbers();
        long selectedDominantNumbers = selected.stream()
                .filter(dominantNumbers::contains)
                .count();

        assertTrue(selectedDominantNumbers >= 3, "单组推荐应优先吸收强回测号码，而不是过度分散到弱信号");
    }

    @Test
    void buildsSingleGroupWithoutSelectedPairsOrThreeNumberRun() {
        LotteryKl8DrawMapper mapper = mock(LotteryKl8DrawMapper.class);
        when(mapper.selectList(any())).thenReturn(latestNeighborTrendDraws());
        LotteryKl8FeatureService service = new LotteryKl8FeatureService(mapper);

        LotteryKl8FeatureReport report = service.buildReport(60);

        List<LotteryKl8PairRecommendation> selectedPairs = report.optimizedPortfolio().pairRecommendations().stream()
                .filter(LotteryKl8PairRecommendation::selected)
                .toList();
        List<Integer> selected = report.optimizedPortfolio().groups().get(0).numbers();

        assertEquals(0, selectedPairs.size(), "新策略不再强制选择核心对子");
        assertEquals(5, selected.size());
        assertFalse(hasConsecutiveRun(selected, 3), "最终 5 码不得出现三连号");
        assertFalse(report.optimizedPortfolio().neighborRecommendations().isEmpty(), "邻位只作为诊断候选保留");
        assertFalse(report.optimizedPortfolio().summary().contains("核心对子"));
    }

    private LotteryKl8NumberProfile profile(LotteryKl8FeatureReport report, int number) {
        return report.numberProfiles().stream()
                .filter(item -> item.number() == number)
                .findFirst()
                .orElseThrow();
    }

    private String lastSql(Wrapper<?> wrapper) {
        try {
            Class<?> type = wrapper.getClass();
            while (type != null) {
                try {
                    Field field = type.getDeclaredField("lastSql");
                    field.setAccessible(true);
                    Object sharedString = field.get(wrapper);
                    return String.valueOf(sharedString.getClass().getMethod("getStringValue").invoke(sharedString));
                } catch (NoSuchFieldException e) {
                    type = type.getSuperclass();
                }
            }
            throw new AssertionError("Wrapper last SQL field not found");
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Wrapper last SQL field can not be read", e);
        }
    }

    private List<LotteryKl8Draw> sampleDraws() {
        return sampleDraws(60);
    }

    private List<LotteryKl8Draw> sampleDraws(int count) {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo("2026%03d".formatted(200 - index));
            draw.setDrawDate(LocalDate.of(2026, 6, 29).minusDays(index));
            List<Integer> numbers = new ArrayList<>();
            numbers.add(1);
            numbers.add(2);
            numbers.add(3 + Math.floorMod(index, 18));
            numbers.add(21 + Math.floorMod(index, 20));
            numbers.add(41 + Math.floorMod(index, 20));
            numbers.add(61 + Math.floorMod(index, 18));
            for (int extra = 0; extra < 14; extra += 1) {
                int value = 1 + Math.floorMod(index * 7 + extra * 5, 79);
                if (!numbers.contains(value) && value != 80) {
                    numbers.add(value);
                }
            }
            if (index >= 30 && !numbers.contains(80)) {
                numbers.set(numbers.size() - 1, 80);
            }
            draw.setNumbers(numbers.stream().sorted().map(String::valueOf).reduce((left, right) -> left + "," + right).orElse(""));
            draws.add(draw);
        }
        return draws;
    }

    private List<LotteryKl8Draw> dominantSignalDraws() {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < 90; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo("2026%03d".formatted(300 - index));
            draw.setDrawDate(LocalDate.of(2026, 7, 1).minusDays(index));
            List<Integer> numbers = new ArrayList<>(List.of(1, 2, 3, 4, 5));
            for (int extra = 0; extra < 15; extra += 1) {
                int value = 6 + Math.floorMod(index * 11 + extra * 7, 75);
                if (!numbers.contains(value)) {
                    numbers.add(value);
                }
            }
            draw.setNumbers(numbers.stream().sorted().map(String::valueOf).reduce((left, right) -> left + "," + right).orElse(""));
            draws.add(draw);
        }
        return draws;
    }

    private List<LotteryKl8Draw> latestNeighborTrendDraws() {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < 90; index += 1) {
            LotteryKl8Draw draw = new LotteryKl8Draw();
            draw.setIssueNo("2026%03d".formatted(400 - index));
            draw.setDrawDate(LocalDate.of(2026, 7, 5).minusDays(index));
            LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
            if (index == 0) {
                numbers.addAll(List.of(10, 11, 12, 34, 35));
            } else {
                numbers.addAll(List.of(9, 10, 11, 12, 13, 33, 34, 36));
            }
            for (int extra = 0; numbers.size() < 20; extra += 1) {
                int value = 1 + Math.floorMod(index * 13 + extra * 7, 80);
                numbers.add(value);
            }
            draw.setNumbers(numbers.stream().sorted().map(String::valueOf).reduce((left, right) -> left + "," + right).orElse(""));
            draws.add(draw);
        }
        return draws;
    }

    private boolean hasConsecutiveRun(List<Integer> numbers, int minRunLength) {
        Set<Integer> numberSet = new LinkedHashSet<>(numbers);
        for (Integer number : numbers) {
            int runLength = 1;
            int next = number + 1;
            while (numberSet.contains(next)) {
                runLength += 1;
                next += 1;
            }
            if (runLength >= minRunLength) {
                return true;
            }
        }
        return false;
    }
}
