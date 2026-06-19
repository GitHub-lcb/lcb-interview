package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.QuestionTagName;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.annotation.Cacheable;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 题目查询服务测试，覆盖公开 API 需要的 VO 组装和分页行为。
 */
class QuestionServiceTest {

    private QuestionMapper questionMapper;
    private CategoryMapper categoryMapper;
    private ViewCountService viewCountService;
    private QuestionService questionService;

    @BeforeEach
    void setUp() {
        questionMapper = mock(QuestionMapper.class);
        categoryMapper = mock(CategoryMapper.class);
        viewCountService = mock(ViewCountService.class);
        questionService = new QuestionService(questionMapper, viewCountService, categoryMapper);
    }

    @Test
    void searchVoEnrichesCategoryNameAndTags() {
        Question question = question(10L, 3L, "HashMap 为什么线程不安全？");
        Page<Question> page = new Page<>(1, 20);
        page.setRecords(List.of(question));
        page.setTotal(1);

        Category category = new Category();
        category.setId(3L);
        category.setName("Java 集合");

        when(questionMapper.selectPage(any(Page.class), any())).thenReturn(page);
        when(categoryMapper.selectBatchIds(List.of(3L))).thenReturn(List.of(category));
        when(questionMapper.selectTagNamesByQuestionIds(List.of(10L))).thenReturn(List.of(
                new QuestionTagName(10L, "Java"),
                new QuestionTagName(10L, "集合")
        ));

        PageResult<QuestionVO> result = questionService.searchVo(null, null, null, null, 0, 20);

        assertThat(result.content()).hasSize(1);
        QuestionVO vo = result.content().getFirst();
        assertThat(vo.categoryName()).isEqualTo("Java 集合");
        assertThat(vo.tags()).containsExactly("Java", "集合");
        assertThat(vo.title()).isEqualTo("HashMap 为什么线程不安全？");
    }

    @Test
    void searchVoUsesPaginatedMapperWhenFilteringByTag() {
        Question question = question(11L, 4L, "JVM 类加载过程是什么？");
        Page<Question> page = new Page<>(2, 5);
        page.setRecords(List.of(question));
        page.setTotal(7);

        Category category = new Category();
        category.setId(4L);
        category.setName("JVM");

        when(questionMapper.selectPageByTagId(any(Page.class), eq(9L))).thenReturn(page);
        when(categoryMapper.selectBatchIds(List.of(4L))).thenReturn(List.of(category));
        when(questionMapper.selectTagNamesByQuestionIds(List.of(11L))).thenReturn(List.of(
                new QuestionTagName(11L, "JVM")
        ));

        PageResult<QuestionVO> result = questionService.searchVo(null, null, null, 9L, 1, 5);

        ArgumentCaptor<Page<?>> pageCaptor = ArgumentCaptor.forClass(Page.class);
        verify(questionMapper).selectPageByTagId(pageCaptor.capture(), eq(9L));
        assertThat(pageCaptor.getValue().getCurrent()).isEqualTo(2);
        assertThat(pageCaptor.getValue().getSize()).isEqualTo(5);
        assertThat(result.total()).isEqualTo(7);
        assertThat(result.content().getFirst().categoryName()).isEqualTo("JVM");
        assertThat(result.content().getFirst().tags()).containsExactly("JVM");
    }

    @Test
    void searchVoFallsBackToLikeWhenFulltextMissesEnglishKeyword() {
        Page<Question> emptyFulltextPage = new Page<>(1, 20);
        emptyFulltextPage.setRecords(List.of());
        emptyFulltextPage.setTotal(0);

        Question question = question(12L, 3L, "Java 中的序列化和反序列化是什么？");
        Page<Question> likePage = new Page<>(1, 20);
        likePage.setRecords(List.of(question));
        likePage.setTotal(1);

        Category category = new Category();
        category.setId(3L);
        category.setName("Java 基础");

        when(questionMapper.searchFulltext(any(Page.class), eq("Java"), isNull(), isNull()))
                .thenReturn(emptyFulltextPage);
        when(questionMapper.searchLike(any(Page.class), eq("Java"), isNull(), isNull()))
                .thenReturn(likePage);
        when(categoryMapper.selectBatchIds(List.of(3L))).thenReturn(List.of(category));
        when(questionMapper.selectTagNamesByQuestionIds(List.of(12L))).thenReturn(List.of(
                new QuestionTagName(12L, "Java")
        ));

        PageResult<QuestionVO> result = questionService.searchVo(null, null, "Java", null, 0, 20);

        verify(questionMapper).searchLike(any(Page.class), eq("Java"), isNull(), isNull());
        assertThat(result.total()).isEqualTo(1);
        assertThat(result.content().getFirst().title()).isEqualTo("Java 中的序列化和反序列化是什么？");
        assertThat(result.content().getFirst().categoryName()).isEqualTo("Java 基础");
        assertThat(result.content().getFirst().tags()).containsExactly("Java");
    }

    @Test
    void getHotVoKeepsCacheBoundaryOnControllerEntryMethod() throws Exception {
        Method method = QuestionService.class.getMethod("getHotVo", int.class);

        Cacheable cacheable = method.getAnnotation(Cacheable.class);

        assertThat(cacheable).isNotNull();
        assertThat(cacheable.value()).containsExactly("hotQuestionVos");
    }

    private Question question(Long id, Long categoryId, String title) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(categoryId);
        question.setTitle(title);
        question.setSummary("summary");
        question.setContent("content");
        question.setDifficulty("MEDIUM");
        question.setViewCount(12);
        question.setCreateTime(LocalDateTime.now());
        question.setStatus("PUBLISHED");
        return question;
    }
}
