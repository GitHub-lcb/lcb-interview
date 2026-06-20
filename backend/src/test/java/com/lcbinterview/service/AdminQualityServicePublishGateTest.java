package com.lcbinterview.service;

import com.lcbinterview.dto.AdminCategoryQualityVO;
import com.lcbinterview.dto.AdminQualitySummaryVO;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 管理后台质量总览发布门槛测试，确保统计口径和草稿审核发布口径一致。
 */
class AdminQualityServicePublishGateTest {

    private final QuestionMapper questionMapper = mock(QuestionMapper.class);
    private final CategoryMapper categoryMapper = mock(CategoryMapper.class);
    private final AdminQualityService service = new AdminQualityService(questionMapper, categoryMapper);

    @Test
    void buildSummaryTreatsAnswerUnderPublishGateLengthAsQualityRisk() {
        when(categoryMapper.selectList(any())).thenReturn(List.of(category(1L)));
        when(questionMapper.selectList(any())).thenReturn(List.of(
                completeQuestion(1L, "PUBLISHED", publishableContent(520)),
                completeQuestion(2L, "DRAFT", publishableContent(320))
        ));

        AdminQualitySummaryVO summary = service.buildSummary();
        AdminCategoryQualityVO category = summary.categories().getFirst();

        assertThat(summary.qualityRiskQuestions()).isEqualTo(1);
        assertThat(category.shortAnswer()).isEqualTo(1);
        assertThat(category.completionRate()).isEqualTo(50);
    }

    private static Category category(Long id) {
        Category category = new Category();
        category.setId(id);
        category.setName("综合题库");
        category.setSortOrder(1);
        return category;
    }

    private static Question completeQuestion(Long id, String status, String content) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(1L);
        question.setTitle("通用架构题目 " + id);
        question.setStatus(status);
        question.setContent(content);
        question.setSummary("a".repeat(50));
        question.setPrinciple("a".repeat(130));
        question.setComparison("a".repeat(90));
        question.setScenario("a".repeat(90));
        question.setRisk("a".repeat(90));
        question.setProjectExp("a".repeat(90));
        question.setCodeExamples("[]");
        question.setDifficulty("MEDIUM");
        return question;
    }

    private static String publishableContent(int extraLength) {
        return """
                30 秒口述版
                标准答案
                面试官评分点
                高频追问
                """
                + "a".repeat(extraLength);
    }
}
