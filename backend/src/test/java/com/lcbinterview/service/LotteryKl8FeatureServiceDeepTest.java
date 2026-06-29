package com.lcbinterview.service;

import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
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
        assertTrue(hotProfile.compositeScore() > 0);
        assertTrue(hotProfile.tags().contains("热号"));
        assertTrue(missingProfile.currentMissing() >= 20);
        assertTrue(missingProfile.tags().contains("高遗漏"));
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

    private LotteryKl8NumberProfile profile(LotteryKl8FeatureReport report, int number) {
        return report.numberProfiles().stream()
                .filter(item -> item.number() == number)
                .findFirst()
                .orElseThrow();
    }

    private List<LotteryKl8Draw> sampleDraws() {
        List<LotteryKl8Draw> draws = new ArrayList<>();
        for (int index = 0; index < 60; index += 1) {
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
}
