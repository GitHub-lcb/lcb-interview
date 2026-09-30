package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Jev 客户端解析测试。只覆盖响应解析分支，不发起真实外呼。
 */
class LotteryKl8JevClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private LotteryKl8JevClient client() {
        JevRuntimeConfigService config = new JevRuntimeConfigService(
                true, false, "sk-test", "jev-latest", "http://localhost/jev", 1000L);
        return new LotteryKl8JevClient(objectMapper, config, HttpClient.newHttpClient());
    }

    @Test
    void parsesAllThreePrimitivesAndInfersType() {
        String body = """
                {
                  "answers": {
                    "n1": {"noul": 0.31},
                    "structure_risk": {"score": 1.6, "legend": {"0": "低", "1": "高"},
                                       "probabilities": {"0": 0.1, "2": 0.5}, "confidence": 0.62},
                    "category": {"choice": "billing", "probabilities": {"billing": 0.84}, "confidence": 0.596}
                  },
                  "model": "jev-1.13.0",
                  "usage": {"input_tokens": 1234, "output_tokens": 7}
                }
                """;

        JevEvaluation evaluation = client().parseResponse(body, 42L);

        assertEquals(3, evaluation.answers().size());
        assertEquals("jev-1.13.0", evaluation.model());
        assertEquals(1234L, evaluation.inputTokens());
        assertEquals(7L, evaluation.outputTokens());
        assertEquals(42L, evaluation.latencyMs());

        JevAnswer noul = evaluation.answer("n1");
        assertTrue(noul.isNoul());
        assertEquals(0.31, noul.probabilityOr(0.25), 0.000001);

        JevAnswer score = evaluation.answer("structure_risk");
        assertTrue(score.isScore());
        assertEquals(1.6, score.score(), 0.000001);
        assertEquals(0.62, score.confidenceOrZero(), 0.000001);
        assertEquals(0.5, score.probabilities().get("2"), 0.000001);
        // legend 必须原样解析出来，它是校验档位是否错位的唯一依据
        assertEquals("低", score.legendAt(0));
        assertTrue(score.legendMatches(List.of("低", "高")));
        assertFalse(score.legendMatches(List.of("低", "中", "高")), "档位数量不符时不得判定为对齐");

        JevAnswer choice = evaluation.answer("category");
        assertTrue(choice.isChoice());
        assertEquals("billing", choice.choice());
        assertEquals(0.84, choice.probabilities().get("billing"), 0.000001);
        assertTrue(choice.legend().isEmpty(), "非 Score 答案不应带档位表");
    }

    @Test
    void noulCriteriaIsSerializedOnlyWhenProvided() throws Exception {
        LotteryKl8JevClient client = client();
        Map<String, String> criteria = Map.of("true", "开出", "false", "未开出");

        String withCriteria = client.serializeRequest("jev-latest", Map.of("a", 1),
                List.of(JevQuestion.noul("n1", "号码 1 会开出吗？", criteria)));
        JsonNode node = objectMapper.readTree(withCriteria).path("questions").path("n1");
        assertEquals("noul", node.path("type").asText());
        assertEquals("开出", node.path("criteria").path("true").asText());

        String withoutCriteria = client.serializeRequest("jev-latest", Map.of("a", 1),
                List.of(JevQuestion.noul("n1", "号码 1 会开出吗？")));
        assertFalse(objectMapper.readTree(withoutCriteria).path("questions").path("n1").has("criteria"),
                "未提供 criteria 时不应凭空提交空对象");
    }

    @Test
    void scoreCriteriaIsSerializedAsOrderedArray() throws Exception {
        String body = client().serializeRequest("jev-latest", "state",
                List.of(JevQuestion.score("risk", "打分", List.of("低", "中", "高"))));

        JsonNode criteria = objectMapper.readTree(body).path("questions").path("risk").path("criteria");

        assertTrue(criteria.isArray(), "Score 的 criteria 必须是有序数组");
        assertEquals("中", criteria.get(1).asText());
    }

    @Test
    void scoreTypeIsInferredFromLegendWhenTypeMissing() {
        JevEvaluation evaluation = client()
                .parseResponse("{\"answers\":{\"risk\":{\"score\":2.5,\"legend\":{\"0\":\"低\",\"1\":\"高\"}}}}", 1L);

        assertTrue(evaluation.answer("risk").isScore(), "仅有 legend 与 score 时应能反推出 Score 类型");
    }

    @Test
    void noulHelpersFallBackOnMissingOrWrongType() {
        String body = """
                {
                  "answers": {
                    "n1": {"noul": 1.5},
                    "risk": {"score": 2.0}
                  }
                }
                """;

        JevEvaluation evaluation = client().parseResponse(body, 1L);

        // 越界概率必须被夹到 [0, 1]，避免脏数据污染后续统计
        assertEquals(1.0, evaluation.answer("n1").probabilityOr(0.25), 0.000001);
        // 缺失问题退避到基线
        assertEquals(0.25, evaluation.noulProbability("missing", 0.25), 0.000001);
        // 类型不匹配同样退避，不能把 Score 档位当成概率使用
        assertEquals(0.25, evaluation.noulProbability("risk", 0.25), 0.000001);
        assertNull(evaluation.answer("missing"));
        assertFalse(evaluation.isEmpty());
    }

    @Test
    void handlesEmptyAndPartialAnswers() {
        JevEvaluation empty = client().parseResponse("{\"answers\":{},\"model\":\"jev-1.0.0\"}", 1L);
        assertTrue(empty.isEmpty());
        assertEquals("jev-1.0.0", empty.model());

        // 缺少 usage 与 model 时不应抛错，按 0 退避
        JevEvaluation partial = client().parseResponse("{\"answers\":{\"n1\":{\"noul\":0.2}}}", 1L);
        assertFalse(partial.isEmpty());
        assertEquals(0L, partial.inputTokens());
        assertEquals("", partial.model());
    }

    @Test
    void nonObjectAnswerNodeIsSkipped() {
        JevEvaluation evaluation = client()
                .parseResponse("{\"answers\":{\"bad\":123,\"n1\":{\"noul\":0.2}}}", 1L);

        assertEquals(1, evaluation.answers().size());
        assertTrue(evaluation.answer("n1").isNoul());
    }

    @Test
    void malformedBodyThrowsIllegalState() {
        assertThrows(IllegalStateException.class, () -> client().parseResponse("not-json", 1L));
    }

    @Test
    void rejectsInvalidQuestionPayloads() {
        assertThrows(IllegalArgumentException.class,
                () -> client().evaluate("state", java.util.List.of()));

        JevQuestion duplicate = JevQuestion.noul("n1", "指令");
        assertThrows(IllegalArgumentException.class,
                () -> client().evaluate("state", java.util.List.of(duplicate, duplicate)));

        JevQuestion blankId = new JevQuestion(" ", JevQuestion.TYPE_NOUL, "指令", java.util.Map.of(), java.util.List.of());
        assertThrows(IllegalArgumentException.class, () -> client().evaluate("state", java.util.List.of(blankId)));
    }
}
