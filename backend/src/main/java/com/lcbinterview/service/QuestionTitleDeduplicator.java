package com.lcbinterview.service;

import com.lcbinterview.model.Question;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * 题目标题去重器。通过归一化空白、标点和大小写，拦截同分类中重复或高度近似的 AI 题目标题。
 */
@Component
public class QuestionTitleDeduplicator {

    /**
     * 判断候选标题是否已经存在于题目列表中。
     *
     * @param candidateTitle 候选标题
     * @param existingQuestions 已有题目列表
     * @return true 表示候选标题重复
     */
    public boolean isDuplicate(String candidateTitle, List<Question> existingQuestions) {
        String normalizedCandidate = normalize(candidateTitle);
        if (normalizedCandidate.isBlank()) {
            return false;
        }
        return existingQuestions.stream()
                .map(Question::getTitle)
                .map(this::normalize)
                .anyMatch(normalizedCandidate::equals);
    }

    private String normalize(String title) {
        if (title == null) {
            return "";
        }
        return title.toLowerCase(Locale.ROOT)
                .replaceAll("[\\p{P}\\p{S}\\s]+", "");
    }
}
