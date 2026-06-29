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
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void validatesDeepAiResult() {
        String json = """
                {
                  "confidenceLabel":"中低",
                  "analysis":{
                    "overview":"近期开奖存在热号延续和高遗漏回补两类信号，但随机性仍是主要风险。",
                    "featureSignals":["1号短中期频率稳定偏高","80号当前遗漏较高"],
                    "combinationLogic":["每组控制区间分散","避免五个号码都来自同一信号"],
                    "riskWarnings":["彩票开奖结果独立随机，历史统计不能保证命中"]
                  },
                  "groups":[
                    {"numbers":[1,8,23,45,67],"reason":"热号与区间均衡组合，兼顾近期频率和分散性。"},
                    {"numbers":[2,16,31,52,80],"reason":"高遗漏号码搭配中区间候选，降低单一信号依赖。"},
                    {"numbers":[3,19,34,58,72],"reason":"覆盖低中高区间，保留趋势上行号码。"},
                    {"numbers":[5,22,39,48,64],"reason":"冷热混合，尾数和奇偶分布较均衡。"},
                    {"numbers":[7,27,43,60,75],"reason":"分散候选池中的不同角色，避免组合重复。"}
                  ]
                }
                """;

        LotteryKl8RecommendationPolicy.ValidatedRecommendation result = policy.validateAiResult(json);

        assertEquals("中低", result.confidenceLabel());
        assertEquals(5, result.groups().size());
        assertTrue(result.analysisJson().contains("featureSignals"));
        assertTrue(result.analysisJson().contains("彩票开奖结果独立随机"));
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
