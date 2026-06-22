package com.lcbinterview.service;

import com.lcbinterview.model.Question;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 题目标题去重测试，避免 AI 在同一分类中反复生成同义标题。
 */
class QuestionTitleDeduplicatorTest {

    private final QuestionTitleDeduplicator deduplicator = new QuestionTitleDeduplicator();

    @Test
    void detectsDuplicateTitleIgnoringWhitespaceAndPunctuation() {
        Question existing = new Question();
        existing.setTitle("HashMap 为什么线程不安全？");

        boolean duplicate = deduplicator.isDuplicate("HashMap为什么线程不安全", List.of(existing));

        assertThat(duplicate).isTrue();
    }

    @Test
    void ignoresBlankAndDifferentTitles() {
        Question existing = new Question();
        existing.setTitle("HashMap 为什么线程不安全？");

        assertThat(deduplicator.isDuplicate("", List.of(existing))).isFalse();
        assertThat(deduplicator.isDuplicate("ConcurrentHashMap 如何保证线程安全？", List.of(existing))).isFalse();
    }
}
