package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationGroupVO;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LotteryKl8RecommendationPolicyTest {

    private final LotteryKl8RecommendationPolicy policy = new LotteryKl8RecommendationPolicy(new ObjectMapper());

    @Test
    void validatesAiGroups() {
        String json = """
                {"groups":[
                  {"numbers":[1,2,3,4,5],"reason":"冷热均衡，覆盖低区间。"},
                  {"numbers":[6,7,8,9,10],"reason":"遗漏回补，兼顾奇偶。"},
                  {"numbers":[11,12,13,14,15],"reason":"近期低频号码参考。"},
                  {"numbers":[16,17,18,19,20],"reason":"热号带动中低区间。"},
                  {"numbers":[21,22,23,24,25],"reason":"分散区间风险参考。"}
                ]}
                """;

        List<LotteryKl8RecommendationGroupVO> groups = policy.validateAiContent(json);

        assertEquals(5, groups.size());
        assertEquals(List.of(1, 2, 3, 4, 5), groups.get(0).numbers());
    }

    @Test
    void rejectsInvalidNumberRange() {
        String json = """
                {"groups":[
                  {"numbers":[1,2,3,4,81],"reason":"无效号码"},
                  {"numbers":[6,7,8,9,10],"reason":"x"},
                  {"numbers":[11,12,13,14,15],"reason":"x"},
                  {"numbers":[16,17,18,19,20],"reason":"x"},
                  {"numbers":[21,22,23,24,25],"reason":"x"}
                ]}
                """;

        assertThrows(IllegalArgumentException.class, () -> policy.validateAiContent(json));
    }

    @Test
    void buildsFallbackGroups() {
        LotteryKl8FeatureReport report = new LotteryKl8FeatureReport(
                20,
                "2026150",
                List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
                List.of(16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30),
                missingMap(),
                Map.of("1-20", 100, "21-40", 100, "41-60", 100, "61-80", 100),
                200,
                200,
                List.of(new LotteryKl8Draw()),
                "测试特征");

        List<LotteryKl8RecommendationGroupVO> groups = policy.fallbackGroups(report);

        assertEquals(5, groups.size());
        groups.forEach(group -> assertEquals(5, group.numbers().size()));
    }

    private Map<Integer, Integer> missingMap() {
        Map<Integer, Integer> values = new LinkedHashMap<>();
        for (int i = 1; i <= 80; i += 1) {
            values.put(i, i);
        }
        return values;
    }
}
