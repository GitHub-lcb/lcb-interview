package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Jev 问题原语测试：三种类型的构造形态直接决定请求体是否会被服务端 422 拒绝。
 */
class JevQuestionTest {

    @Test
    void noulCarriesNeitherCriteriaNorLevels() {
        JevQuestion question = JevQuestion.noul("n37", "号码 37 是否会在下一期开出？");

        assertEquals(JevQuestion.TYPE_NOUL, question.type());
        assertEquals("n37", question.id());
        assertTrue(question.criteria().isEmpty());
        assertTrue(question.levels().isEmpty());
    }

    @Test
    void choiceCarriesOptionMap() {
        JevQuestion question = JevQuestion.choice("dept", "哪个团队处理？",
                Map.of("billing", "账单问题", "technical", "技术问题"));

        assertEquals(JevQuestion.TYPE_CHOICE, question.type());
        assertEquals(2, question.criteria().size());
        assertEquals("账单问题", question.criteria().get("billing"));
        assertTrue(question.levels().isEmpty());
    }

    @Test
    void scoreCarriesOrderedLevels() {
        JevQuestion question = JevQuestion.score("risk", "风险打分", List.of("低", "中", "高"));

        assertEquals(JevQuestion.TYPE_SCORE, question.type());
        assertEquals(List.of("低", "中", "高"), question.levels());
        assertTrue(question.criteria().isEmpty());
    }

    @Test
    void scoreRejectsOutOfRangeLevelCount() {
        // Jev 官方限定 Score 档位为 2-10 个，越界必须在本地拦截而不是等服务端 422
        assertThrows(IllegalArgumentException.class,
                () -> JevQuestion.score("risk", "指令", List.of("只有一档")));
        assertThrows(IllegalArgumentException.class,
                () -> JevQuestion.score("risk", "指令",
                        List.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11")));
    }
}
