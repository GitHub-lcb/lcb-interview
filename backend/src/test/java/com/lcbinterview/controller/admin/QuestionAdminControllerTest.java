package com.lcbinterview.controller.admin;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.config.AdminTokenFilter;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import com.lcbinterview.service.AiAnswerQualityPolicy;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端草稿审核接口测试，确保空答案草稿不会被发布到公开题库。
 */
@WebMvcTest(QuestionAdminController.class)
@Import(AdminTokenFilter.class)
@TestPropertySource(properties = "admin.token=test-token")
class QuestionAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private QuestionMapper questionMapper;

    @MockBean
    private AiAnswerQualityPolicy aiAnswerQualityPolicy;

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void listDraftsAppliesQualityRiskAndKeywordFilters() throws Exception {
        when(questionMapper.selectPage(any(Page.class), any(Wrapper.class)))
                .thenReturn(new Page<Question>(1, 20, 0));

        mockMvc.perform(get("/api/admin/questions/draft")
                        .header("Authorization", "Bearer test-token")
                        .param("riskType", "EMPTY_ANSWER")
                        .param("keyword", "redis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Wrapper<Question>> wrapperCaptor = ArgumentCaptor.forClass((Class) Wrapper.class);
        verify(questionMapper).selectPage(any(Page.class), wrapperCaptor.capture());
        QueryWrapper<Question> queryWrapper = (QueryWrapper<Question>) wrapperCaptor.getValue();
        String sqlSegment = queryWrapper.getCustomSqlSegment();
        assertThat(sqlSegment)
                .contains("status")
                .contains("title LIKE")
                .contains("summary LIKE")
                .contains("TRIM(content) = ''");
        assertThat(queryWrapper.getParamNameValuePairs()).containsValue("DRAFT");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void listDraftsShortAnswerFilterUsesPublishGateLength() throws Exception {
        when(questionMapper.selectPage(any(Page.class), any(Wrapper.class)))
                .thenReturn(new Page<Question>(1, 20, 0));

        mockMvc.perform(get("/api/admin/questions/draft")
                        .header("Authorization", "Bearer test-token")
                        .param("riskType", "SHORT_ANSWER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Wrapper<Question>> wrapperCaptor = ArgumentCaptor.forClass((Class) Wrapper.class);
        verify(questionMapper).selectPage(any(Page.class), wrapperCaptor.capture());
        QueryWrapper<Question> queryWrapper = (QueryWrapper<Question>) wrapperCaptor.getValue();
        assertThat(queryWrapper.getCustomSqlSegment()).contains("CHAR_LENGTH(content)");
        assertThat(queryWrapper.getParamNameValuePairs()).containsValue(500);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void listDraftsFiltersEmptyContentDrafts() throws Exception {
        when(questionMapper.selectPage(any(Page.class), any(Wrapper.class)))
                .thenReturn(new Page<Question>(1, 20, 0));

        mockMvc.perform(get("/api/admin/questions/draft")
                        .header("Authorization", "Bearer test-token")
                        .param("contentStatus", "EMPTY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Wrapper<Question>> wrapperCaptor = ArgumentCaptor.forClass((Class) Wrapper.class);
        verify(questionMapper).selectPage(any(Page.class), wrapperCaptor.capture());
        QueryWrapper<Question> queryWrapper = (QueryWrapper<Question>) wrapperCaptor.getValue();
        assertThat(queryWrapper.getCustomSqlSegment())
                .contains("TRIM(content) = ''")
                .contains("TRIM(answer) = ''");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void listDraftsFiltersDraftsWithContent() throws Exception {
        when(questionMapper.selectPage(any(Page.class), any(Wrapper.class)))
                .thenReturn(new Page<Question>(1, 20, 0));

        mockMvc.perform(get("/api/admin/questions/draft")
                        .header("Authorization", "Bearer test-token")
                        .param("contentStatus", "WITH_CONTENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Wrapper<Question>> wrapperCaptor = ArgumentCaptor.forClass((Class) Wrapper.class);
        verify(questionMapper).selectPage(any(Page.class), wrapperCaptor.capture());
        QueryWrapper<Question> queryWrapper = (QueryWrapper<Question>) wrapperCaptor.getValue();
        assertThat(queryWrapper.getCustomSqlSegment())
                .contains("content IS NOT NULL")
                .contains("TRIM(content) <> ''")
                .contains("answer IS NOT NULL")
                .contains("TRIM(answer) <> ''");
    }

    @Test
    void approveRejectsDraftWithoutContent() throws Exception {
        Question draft = new Question();
        draft.setId(10L);
        draft.setStatus("DRAFT");
        draft.setContent("");
        when(questionMapper.selectById(10L)).thenReturn(draft);

        mockMvc.perform(post("/api/admin/questions/draft/10/approve")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(400)))
                .andExpect(jsonPath("$.message", is("题目答案为空，不能发布")));

        verify(questionMapper, never()).updateById(any(Question.class));
    }

    @Test
    void approveRejectsDraftWhenQualityGateFails() throws Exception {
        Question draft = qualityDraft(12L);
        when(questionMapper.selectById(12L)).thenReturn(draft);
        when(aiAnswerQualityPolicy.evaluateGeneratedQuestion("未知分类", draft))
                .thenReturn(new AiAnswerQualityPolicy.QualityReport(70, List.of("content 内容少于 500 字")));

        mockMvc.perform(post("/api/admin/questions/draft/12/approve")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(400)))
                .andExpect(jsonPath("$.message", is("题目质量未达标：content 内容少于 500 字")));

        verify(questionMapper, never()).updateById(any(Question.class));
    }

    @Test
    void approvePublishesDraftWhenQualityGatePasses() throws Exception {
        Question draft = qualityDraft(13L);
        when(questionMapper.selectById(13L)).thenReturn(draft);
        when(aiAnswerQualityPolicy.evaluateGeneratedQuestion("未知分类", draft))
                .thenReturn(new AiAnswerQualityPolicy.QualityReport(95, List.of()));

        mockMvc.perform(post("/api/admin/questions/draft/13/approve")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Question> questionCaptor = ArgumentCaptor.forClass(Question.class);
        verify(questionMapper).updateById(questionCaptor.capture());
        assertThat(questionCaptor.getValue().getId()).isEqualTo(13L);
        assertThat(questionCaptor.getValue().getStatus()).isEqualTo("PUBLISHED");
    }

    @Test
    void approveAppliesAiRewriteDraftToOriginalPublishedQuestion() throws Exception {
        Question rewriteDraft = qualityDraft(20L);
        rewriteDraft.setSource("AI_REWRITE");
        rewriteDraft.setRelatedIds("[99]");
        rewriteDraft.setSummary("新摘要");
        rewriteDraft.setContent("新答案内容");
        rewriteDraft.setAnswer("新答案内容");
        rewriteDraft.setPrinciple("新原理");
        rewriteDraft.setComparison("新对比");
        rewriteDraft.setScenario("新场景");
        rewriteDraft.setRisk("新风险");
        rewriteDraft.setProjectExp("新项目经验");
        rewriteDraft.setCodeExamples("[{\"lang\":\"java\",\"code\":\"new answer\"}]");

        Question original = qualityDraft(99L);
        original.setStatus("PUBLISHED");
        original.setSource("AI_GENERATED");
        when(questionMapper.selectById(20L)).thenReturn(rewriteDraft);
        when(questionMapper.selectById(99L)).thenReturn(original);
        when(aiAnswerQualityPolicy.evaluateGeneratedQuestion("未知分类", rewriteDraft))
                .thenReturn(new AiAnswerQualityPolicy.QualityReport(95, List.of()));

        mockMvc.perform(post("/api/admin/questions/draft/20/approve")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Question> questionCaptor = ArgumentCaptor.forClass(Question.class);
        verify(questionMapper).updateById(questionCaptor.capture());
        Question originalUpdate = questionCaptor.getValue();
        assertThat(originalUpdate.getId()).isEqualTo(99L);
        assertThat(originalUpdate.getSummary()).isEqualTo("新摘要");
        assertThat(originalUpdate.getContent()).isEqualTo("新答案内容");
        assertThat(originalUpdate.getAnswer()).isEqualTo("新答案内容");
        assertThat(originalUpdate.getPrinciple()).isEqualTo("新原理");
        assertThat(originalUpdate.getStatus()).isNull();
        verify(questionMapper).deleteById(20L);
    }

    @Test
    void batchApproveRejectsWhenAnyDraftHasNoContent() throws Exception {
        Question emptyDraft = new Question();
        emptyDraft.setId(10L);
        emptyDraft.setStatus("DRAFT");
        emptyDraft.setContent("");
        when(questionMapper.selectBatchIds(List.of(10L, 11L))).thenReturn(List.of(emptyDraft));

        mockMvc.perform(post("/api/admin/questions/draft/batch-approve")
                        .header("Authorization", "Bearer test-token")
                        .contentType("application/json")
                        .content("[10,11]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(400)))
                .andExpect(jsonPath("$.message", is("存在答案为空的草稿，不能批量发布")));

        verify(questionMapper, never()).update(any(), any());
    }

    @Test
    void batchApproveRejectsWhenAnyDraftFailsQualityGate() throws Exception {
        Question weakDraft = qualityDraft(14L);
        weakDraft.setTitle("Redis 缓存击穿是什么");
        when(questionMapper.selectBatchIds(List.of(14L, 15L))).thenReturn(List.of(weakDraft));
        when(aiAnswerQualityPolicy.evaluateGeneratedQuestion("未知分类", weakDraft))
                .thenReturn(new AiAnswerQualityPolicy.QualityReport(65, List.of("risk 风险与避坑缺失或过短")));

        mockMvc.perform(post("/api/admin/questions/draft/batch-approve")
                        .header("Authorization", "Bearer test-token")
                        .contentType("application/json")
                        .content("[14,15]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(400)))
                .andExpect(jsonPath("$.message", is("存在质量未达标的草稿：Redis 缓存击穿是什么；risk 风险与避坑缺失或过短")));

        verify(questionMapper, never()).update(any(), any());
    }

    @Test
    void batchApproveAppliesAiRewriteDraftToOriginalPublishedQuestion() throws Exception {
        Question rewriteDraft = qualityDraft(21L);
        rewriteDraft.setSource("AI_REWRITE");
        rewriteDraft.setRelatedIds("[101]");
        rewriteDraft.setSummary("批量新摘要");
        rewriteDraft.setContent("批量新答案");
        rewriteDraft.setAnswer("批量新答案");

        Question original = qualityDraft(101L);
        original.setStatus("PUBLISHED");
        when(questionMapper.selectBatchIds(List.of(21L))).thenReturn(List.of(rewriteDraft));
        when(questionMapper.selectById(101L)).thenReturn(original);
        when(aiAnswerQualityPolicy.evaluateGeneratedQuestion("未知分类", rewriteDraft))
                .thenReturn(new AiAnswerQualityPolicy.QualityReport(95, List.of()));

        mockMvc.perform(post("/api/admin/questions/draft/batch-approve")
                        .header("Authorization", "Bearer test-token")
                        .contentType("application/json")
                        .content("[21]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)));

        ArgumentCaptor<Question> questionCaptor = ArgumentCaptor.forClass(Question.class);
        verify(questionMapper).updateById(questionCaptor.capture());
        assertThat(questionCaptor.getValue().getId()).isEqualTo(101L);
        assertThat(questionCaptor.getValue().getSummary()).isEqualTo("批量新摘要");
        assertThat(questionCaptor.getValue().getContent()).isEqualTo("批量新答案");
        verify(questionMapper).deleteById(21L);
        verify(questionMapper, never()).update(any(), any());
    }

    private Question qualityDraft(Long id) {
        Question draft = new Question();
        draft.setId(id);
        draft.setTitle("Java HashMap 为什么线程不安全");
        draft.setStatus("DRAFT");
        draft.setDifficulty("MEDIUM");
        draft.setSummary("HashMap 在并发写入时没有同步保护，可能出现数据覆盖、链表或树结构异常以及读到不一致结果。");
        draft.setContent("这是一段已经填写的答案内容，用于绕过空答案校验，具体质量由 AiAnswerQualityPolicy mock 决定。");
        draft.setPrinciple("HashMap 的数组、链表和红黑树结构在扩容与写入时会修改共享状态，并发访问没有 happens-before 保证。");
        draft.setComparison("ConcurrentHashMap 通过更细粒度的同步与 CAS 控制并发修改，适合并发读写场景。");
        draft.setScenario("单线程或外部加锁时可以使用 HashMap，高并发共享写入时应选择并发容器。");
        draft.setRisk("线上风险主要是数据丢失、读取不一致和偶发异常，排查成本高。");
        draft.setProjectExp("项目中可以说明缓存本地索引曾从 HashMap 改成 ConcurrentHashMap，并补充压测和竞态测试。");
        draft.setCodeExamples("[{\"lang\":\"java\",\"title\":\"示例\",\"code\":\"new ConcurrentHashMap<>()\",\"description\":\"并发容器\"}]");
        return draft;
    }
}
