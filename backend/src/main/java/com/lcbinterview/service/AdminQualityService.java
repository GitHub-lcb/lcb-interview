package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.lcbinterview.dto.AdminCategoryQualityVO;
import com.lcbinterview.dto.AdminQualitySummaryVO;
import com.lcbinterview.dto.AdminQualityTodoVO;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理后台质量服务，负责把题目状态和内容完整度聚合成可运营的质量看板数据。
 */
@Service
@RequiredArgsConstructor
public class AdminQualityService {

    private static final int SHORT_ANSWER_MIN_CHARS = 500;
    private static final int SUMMARY_MIN_CHARS = 40;
    private static final int PRINCIPLE_MIN_CHARS = 120;
    private static final int DETAIL_MIN_CHARS = 80;
    private static final List<String> VALID_DIFFICULTIES = List.of("EASY", "MEDIUM", "HARD");
    private static final List<String> CODE_KEYWORDS = List.of(
            "代码", "实现", "SQL", "算法", "配置", "线程", "并发", "锁", "Spring", "MyBatis",
            "Redis", "MySQL", "Kafka", "RabbitMQ", "Docker", "K8s", "Java");

    private final QuestionMapper questionMapper;
    private final CategoryMapper categoryMapper;

    /**
     * 构建管理后台质量总览。
     *
     * @return 全站题目状态、分类风险排行和待办事项
     */
    @Transactional(readOnly = true)
    public AdminQualitySummaryVO buildSummary() {
        List<Category> categories = categoryMapper.selectList(new QueryWrapper<Category>()
                .select("id", "name", "sort_order"));
        List<Question> questions = questionMapper.selectList(new QueryWrapper<Question>()
                .select("id", "category_id", "title", "summary", "content", "answer", "principle",
                        "comparison", "scenario", "risk", "project_exp", "code_examples",
                        "difficulty", "status"));

        Map<Long, CategoryStats> statsByCategory = buildCategoryStats(categories);
        SummaryStats summaryStats = new SummaryStats();
        for (Question question : questions) {
            CategoryStats categoryStats = statsByCategory.computeIfAbsent(
                    question.getCategoryId(),
                    categoryId -> CategoryStats.unknown(categoryId));
            accumulate(question, categoryStats, summaryStats);
        }

        List<AdminCategoryQualityVO> categoryRows = statsByCategory.values().stream()
                .filter(stats -> stats.total > 0)
                .map(CategoryStats::toVO)
                .sorted(Comparator.comparing(AdminCategoryQualityVO::riskScore).reversed()
                        .thenComparing(AdminCategoryQualityVO::total, Comparator.reverseOrder())
                        .thenComparing(AdminCategoryQualityVO::categoryName))
                .toList();

        return new AdminQualitySummaryVO(
                summaryStats.total,
                summaryStats.published,
                summaryStats.draft,
                summaryStats.rejected,
                summaryStats.emptyAnswer,
                summaryStats.qualityRisk,
                completionRate(summaryStats.total, summaryStats.qualityRisk),
                categoryRows,
                buildTodos(summaryStats, categoryRows)
        );
    }

    private Map<Long, CategoryStats> buildCategoryStats(List<Category> categories) {
        List<Category> sortedCategories = categories.stream()
                .sorted(Comparator.comparing(
                                Category::getSortOrder,
                                Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(Category::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();
        Map<Long, CategoryStats> statsByCategory = new LinkedHashMap<>();
        for (Category category : sortedCategories) {
            statsByCategory.put(category.getId(), new CategoryStats(
                    category.getId(), category.getName()));
        }
        return statsByCategory;
    }

    private void accumulate(Question question, CategoryStats categoryStats, SummaryStats summaryStats) {
        boolean emptyAnswer = isAnswerEmpty(question);
        String answer = mainAnswer(question);
        boolean shortAnswer = !emptyAnswer && answer.length() < SHORT_ANSWER_MIN_CHARS;
        boolean missingSummary = isTooShort(question.getSummary(), SUMMARY_MIN_CHARS);
        boolean missingPrinciple = isTooShort(question.getPrinciple(), PRINCIPLE_MIN_CHARS);
        boolean missingComparison = isTooShort(question.getComparison(), DETAIL_MIN_CHARS);
        boolean missingScenario = isTooShort(question.getScenario(), DETAIL_MIN_CHARS);
        boolean missingRisk = isTooShort(question.getRisk(), DETAIL_MIN_CHARS);
        boolean missingProjectExp = isTooShort(question.getProjectExp(), DETAIL_MIN_CHARS);
        boolean missingContentSections = !emptyAnswer && missingRequiredContentSections(answer);
        boolean missingCodeExamples = needsCodeExample(question, categoryStats)
                && !hasCodeExample(question.getCodeExamples());
        boolean invalidDifficulty = !VALID_DIFFICULTIES.contains(textOrEmpty(question.getDifficulty()));
        boolean qualityRisk = emptyAnswer || shortAnswer || missingSummary || missingPrinciple
                || missingComparison || missingScenario || missingRisk || missingProjectExp
                || missingContentSections || missingCodeExamples || invalidDifficulty;

        summaryStats.total++;
        categoryStats.total++;

        if ("PUBLISHED".equals(question.getStatus())) {
            summaryStats.published++;
            categoryStats.published++;
        } else if ("DRAFT".equals(question.getStatus())) {
            summaryStats.draft++;
            categoryStats.draft++;
        } else if ("REJECTED".equals(question.getStatus())) {
            summaryStats.rejected++;
            categoryStats.rejected++;
        }

        if (emptyAnswer) {
            summaryStats.emptyAnswer++;
            categoryStats.emptyAnswer++;
        }
        if (shortAnswer) {
            categoryStats.shortAnswer++;
        }
        if (missingSummary) {
            categoryStats.missingSummary++;
        }
        if (missingPrinciple) {
            categoryStats.missingPrinciple++;
        }
        if (missingComparison) {
            categoryStats.missingComparison++;
        }
        if (missingScenario) {
            categoryStats.missingScenario++;
        }
        if (missingRisk) {
            categoryStats.missingRisk++;
        }
        if (missingProjectExp) {
            categoryStats.missingProjectExp++;
        }
        if (missingContentSections) {
            categoryStats.missingContentSections++;
        }
        if (missingCodeExamples) {
            categoryStats.missingCodeExamples++;
        }
        if (invalidDifficulty) {
            categoryStats.invalidDifficulty++;
        }
        if (qualityRisk) {
            summaryStats.qualityRisk++;
            categoryStats.qualityRisk++;
        }
    }

    private List<AdminQualityTodoVO> buildTodos(
            SummaryStats summaryStats,
            List<AdminCategoryQualityVO> categoryRows) {
        List<AdminQualityTodoVO> todos = new ArrayList<>();
        if (summaryStats.emptyAnswer > 0) {
            todos.add(new AdminQualityTodoVO(
                    "EMPTY_ANSWER",
                    "补齐空答案",
                    "空答案不能进入发布流程，优先进入 AI 补答案或人工补写。",
                    null,
                    null,
                    summaryStats.emptyAnswer,
                    "danger"));
        }
        categoryRows.stream()
                .filter(row -> row.riskScore() > 0)
                .findFirst()
                .ifPresent(row -> todos.add(new AdminQualityTodoVO(
                        "QUALITY_RISK",
                        "处理高风险题库",
                        row.categoryName() + " 的结构缺口最多，建议先集中重写该分类。",
                        row.categoryId(),
                        row.categoryName(),
                        row.riskScore(),
                        "warning")));
        if (summaryStats.draft > 0) {
            todos.add(new AdminQualityTodoVO(
                    "DRAFT_REVIEW",
                    "审核待发布草稿",
                    "草稿发布前需要确认答案完整、边界清晰且没有重复题。",
                    null,
                    null,
                    summaryStats.draft,
                    "default"));
        }
        if (summaryStats.rejected > 0) {
            todos.add(new AdminQualityTodoVO(
                    "REJECTED_REPAIR",
                    "复盘驳回题目",
                    "驳回题目应回流到重写池，避免长期堆积。",
                    null,
                    null,
                    summaryStats.rejected,
                    "default"));
        }
        if (todos.isEmpty()) {
            todos.add(new AdminQualityTodoVO(
                    "QUALITY_HEALTHY",
                    "质量状态稳定",
                    "当前没有阻塞发布的结构性风险。",
                    null,
                    null,
                    0,
                    "success"));
        }
        return todos;
    }

    private boolean isAnswerEmpty(Question question) {
        return isBlank(question.getContent()) && isBlank(question.getAnswer());
    }

    private String mainAnswer(Question question) {
        if (!isBlank(question.getContent())) {
            return question.getContent().trim();
        }
        if (!isBlank(question.getAnswer())) {
            return question.getAnswer().trim();
        }
        return "";
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isTooShort(String value, int minLength) {
        return value == null || value.trim().length() < minLength;
    }

    private static boolean missingRequiredContentSections(String answer) {
        return !answer.contains("30 秒口述版")
                || !answer.contains("标准答案")
                || !answer.contains("面试官评分点")
                || !answer.contains("高频追问");
    }

    private static boolean needsCodeExample(Question question, CategoryStats categoryStats) {
        String text = String.join(" ",
                textOrEmpty(question.getTitle()),
                textOrEmpty(categoryStats.categoryName));
        return CODE_KEYWORDS.stream().anyMatch(text::contains);
    }

    private static boolean hasCodeExample(String codeExamples) {
        return !isBlank(codeExamples) && !"[]".equals(codeExamples.trim());
    }

    private static String textOrEmpty(String value) {
        return value == null ? "" : value;
    }

    private static int completionRate(long total, long risk) {
        if (total == 0) {
            return 100;
        }
        long healthy = Math.max(0, total - risk);
        return (int) Math.round(healthy * 100.0 / total);
    }

    private static final class SummaryStats {
        private long total;
        private long published;
        private long draft;
        private long rejected;
        private long emptyAnswer;
        private long qualityRisk;
    }

    private static final class CategoryStats {
        private final Long categoryId;
        private final String categoryName;
        private long total;
        private long published;
        private long draft;
        private long rejected;
        private long emptyAnswer;
        private long shortAnswer;
        private long missingSummary;
        private long missingPrinciple;
        private long missingComparison;
        private long missingScenario;
        private long missingRisk;
        private long missingProjectExp;
        private long missingContentSections;
        private long missingCodeExamples;
        private long invalidDifficulty;
        private long qualityRisk;

        private CategoryStats(Long categoryId, String categoryName) {
            this.categoryId = categoryId;
            this.categoryName = categoryName;
        }

        private static CategoryStats unknown(Long categoryId) {
            String name = categoryId == null ? "未分类" : "未分类 #" + categoryId;
            return new CategoryStats(categoryId, name);
        }

        private AdminCategoryQualityVO toVO() {
            int riskScore = Math.toIntExact(
                    emptyAnswer * 8
                            + shortAnswer * 3
                            + missingSummary * 2
                            + missingPrinciple * 2
                            + missingComparison * 2
                            + missingScenario * 2
                            + missingRisk * 2
                            + missingProjectExp * 2
                            + missingContentSections * 2
                            + missingCodeExamples * 2
                            + invalidDifficulty * 2
                            + draft
                            + rejected);
            return new AdminCategoryQualityVO(
                    categoryId,
                    categoryName,
                    total,
                    published,
                    draft,
                    rejected,
                    emptyAnswer,
                    shortAnswer,
                    missingPrinciple,
                    missingRisk,
                    missingProjectExp,
                    missingCodeExamples,
                    missingSummary,
                    missingComparison,
                    missingScenario,
                    missingContentSections,
                    invalidDifficulty,
                    completionRate(total, qualityRisk),
                    riskScore);
        }
    }
}
