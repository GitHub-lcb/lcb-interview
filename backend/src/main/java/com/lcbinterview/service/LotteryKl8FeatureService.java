package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * 快乐8历史特征服务，为 AI 推荐提供结构化统计输入。
 */
@Service
@RequiredArgsConstructor
public class LotteryKl8FeatureService {

    private final LotteryKl8DrawMapper drawMapper;

    /**
     * 基于最近指定期数构建快乐8特征报告。
     *
     * @param baseIssueCount 使用历史期数
     * @return 特征报告
     */
    @Transactional(readOnly = true)
    public LotteryKl8FeatureReport buildReport(int baseIssueCount) {
        int limit = Math.max(20, Math.min(500, baseIssueCount));
        List<LotteryKl8Draw> draws = drawMapper.selectList(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getDrawDate)
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT " + limit));
        if (draws.size() < 20) {
            throw new BusinessException(400, "历史开奖数据不足 20 期，请先同步开奖数据");
        }
        Map<Integer, Integer> frequency = initNumberMap(0);
        Map<Integer, Integer> missing = initNumberMap(draws.size());
        int odd = 0;
        int even = 0;
        Map<String, Integer> ranges = new LinkedHashMap<>();
        ranges.put("1-20", 0);
        ranges.put("21-40", 0);
        ranges.put("41-60", 0);
        ranges.put("61-80", 0);

        for (int index = 0; index < draws.size(); index += 1) {
            Set<Integer> numbers = parseNumbers(draws.get(index).getNumbers()).stream().collect(Collectors.toSet());
            for (Integer number : numbers) {
                frequency.put(number, frequency.get(number) + 1);
                missing.put(number, Math.min(missing.get(number), index));
                if (number % 2 == 0) {
                    even += 1;
                } else {
                    odd += 1;
                }
                ranges.compute(rangeLabel(number), (key, value) -> value == null ? 1 : value + 1);
            }
        }

        List<Integer> hot = rank(frequency, true);
        List<Integer> cold = rank(frequency, false);
        String latestIssueNo = draws.get(0).getIssueNo();
        return new LotteryKl8FeatureReport(
                draws.size(),
                latestIssueNo,
                hot,
                cold,
                missing,
                ranges,
                odd,
                even,
                draws,
                buildSummary(draws.size(), latestIssueNo, hot, cold, ranges, odd, even));
    }

    /**
     * 解析逗号分隔号码。
     *
     * @param numbers 号码字符串
     * @return 号码列表
     */
    public List<Integer> parseNumbers(String numbers) {
        if (numbers == null || numbers.isBlank()) {
            return List.of();
        }
        List<Integer> result = new ArrayList<>();
        for (String part : numbers.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isBlank()) {
                result.add(Integer.parseInt(trimmed));
            }
        }
        return result;
    }

    private Map<Integer, Integer> initNumberMap(int value) {
        Map<Integer, Integer> map = new LinkedHashMap<>();
        IntStream.rangeClosed(1, 80).forEach(number -> map.put(number, value));
        return map;
    }

    private List<Integer> rank(Map<Integer, Integer> frequency, boolean desc) {
        Comparator<Map.Entry<Integer, Integer>> comparator = Map.Entry.comparingByValue();
        if (desc) {
            comparator = comparator.reversed();
        }
        return frequency.entrySet().stream()
                .sorted(comparator.thenComparing(Map.Entry.comparingByKey()))
                .limit(15)
                .map(Map.Entry::getKey)
                .toList();
    }

    private String rangeLabel(int number) {
        if (number <= 20) {
            return "1-20";
        }
        if (number <= 40) {
            return "21-40";
        }
        if (number <= 60) {
            return "41-60";
        }
        return "61-80";
    }

    private String buildSummary(
            int count,
            String latestIssueNo,
            List<Integer> hot,
            List<Integer> cold,
            Map<String, Integer> ranges,
            int odd,
            int even) {
        return "近 %d 期，最新期号 %s。热号 %s，冷号 %s。区间分布 %s，奇偶比 %d:%d。"
                .formatted(count, latestIssueNo, hot.subList(0, Math.min(8, hot.size())),
                        cold.subList(0, Math.min(8, cold.size())), ranges, odd, even);
    }
}
