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
 * 管理后台质量总览测试，确保后台能发现题库内容缺口和高风险分类。
 */
class AdminQualityServiceTest {

    private final QuestionMapper questionMapper = mock(QuestionMapper.class);
    private final CategoryMapper categoryMapper = mock(CategoryMapper.class);
    private final AdminQualityService service = new AdminQualityService(questionMapper, categoryMapper);

    @Test
    void buildSummaryAggregatesQuestionQualityAndPrioritizesRiskyCategories() {
        when(categoryMapper.selectList(any())).thenReturn(List.of(
                category(1L, "Java 基础", 10),
                category(2L, "Redis", 20)
        ));
        when(questionMapper.selectList(any())).thenReturn(List.of(
                question(1L, 1L, "PUBLISHED", publishableContent(520), repeat("原理", 70),
                        repeat("风险", 45), repeat("项目", 45), validCodeExample()),
                question(2L, 1L, "DRAFT", "太短", "", "", "", ""),
                question(3L, 2L, "DRAFT", "   ", "", "", "", ""),
                question(4L, 2L, "REJECTED", publishableContent(520), repeat("原理", 70),
                        repeat("风险", 45), repeat("项目", 45), "")
        ));

        AdminQualitySummaryVO summary = service.buildSummary();

        assertThat(summary.totalQuestions()).isEqualTo(4);
        assertThat(summary.publishedQuestions()).isEqualTo(1);
        assertThat(summary.draftQuestions()).isEqualTo(2);
        assertThat(summary.rejectedQuestions()).isEqualTo(1);
        assertThat(summary.emptyAnswerQuestions()).isEqualTo(1);
        assertThat(summary.qualityRiskQuestions()).isEqualTo(3);

        assertThat(summary.categories())
                .extracting(AdminCategoryQualityVO::categoryName)
                .containsExactly("Redis", "Java 基础");
        assertThat(summary.categories().getFirst().emptyAnswer()).isEqualTo(1);
        assertThat(summary.categories().getFirst().riskScore()).isGreaterThan(summary.categories().getLast().riskScore());

        assertThat(summary.todos())
                .extracting(todo -> todo.type())
                .contains("EMPTY_ANSWER", "QUALITY_RISK", "DRAFT_REVIEW");
    }

    private static Category category(Long id, String name, int sortOrder) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setSortOrder(sortOrder);
        return category;
    }

    private static Question question(
            Long id,
            Long categoryId,
            String status,
            String content,
            String principle,
            String risk,
            String projectExp,
            String codeExamples) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(categoryId);
        question.setTitle("题目 " + id);
        question.setStatus(status);
        question.setContent(content);
        question.setSummary(repeat("摘要", 25));
        question.setPrinciple(principle);
        question.setComparison(repeat("对比", 45));
        question.setScenario(repeat("场景", 45));
        question.setRisk(risk);
        question.setProjectExp(projectExp);
        question.setCodeExamples(codeExamples);
        question.setDifficulty("MEDIUM");
        return question;
    }

    private static String repeat(String value, int times) {
        return value.repeat(times);
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

    private static String validCodeExample() {
        return "[{\"lang\":\"java\",\"title\":\"示例\",\"code\":\"System.out.println();\",\"description\":\"示例\"}]";
    }
}
