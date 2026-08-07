package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgePointCleaningServiceTest {

    private QuestionMapper questionMapper;
    private CategoryMapper categoryMapper;
    private KnowledgePointPersistenceService persistenceService;
    private AiRuntimeConfigService aiRuntimeConfigService;
    private AiHttpClient aiHttpClient;
    private KnowledgePointCleaningService service;

    @BeforeEach
    void setUp() {
        questionMapper = mock(QuestionMapper.class);
        categoryMapper = mock(CategoryMapper.class);
        persistenceService = mock(KnowledgePointPersistenceService.class);
        aiRuntimeConfigService = mock(AiRuntimeConfigService.class);
        aiHttpClient = mock(AiHttpClient.class);
        service = new KnowledgePointCleaningService(
                questionMapper, categoryMapper, persistenceService,
                aiRuntimeConfigService, aiHttpClient, new ObjectMapper());
        when(categoryMapper.selectList(null)).thenReturn(List.of(category(1L, "Java 基础")));
        when(aiRuntimeConfigService.current()).thenReturn(new AiRuntimeConfig(
                "test-key", "test-model", "https://test/api", true));
        when(persistenceService.persistCleaningBatch(any(), any(), any()))
                .thenReturn(new KnowledgePointPersistenceService.CleaningWriteResult(0, 0));
    }

    @Test
    void startRejectsConcurrentRun() throws Exception {
        Question question = question(1L, 1L, "HashMap 的原理是什么？");
        stubQuestionPages(1L, List.of(question));
        CountDownLatch latch = new CountDownLatch(1);
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenAnswer(invocation -> {
            latch.await(5, TimeUnit.SECONDS);
            return response("{\"items\":[{\"questionId\":1,\"knowledgePoints\":[\"HashMap原理\"]}]}");
        });

        assertTrue(service.start());
        assertFalse(service.start());
        latch.countDown();
        waitForIdle();
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void validatesEveryQuestionAndDelegatesOneAtomicBatch() {
        Question q1 = question(1L, 1L, "HashMap 的原理是什么？");
        Question q2 = question(5L, 1L, "JVM 内存模型讲解");
        when(questionMapper.selectMaxPublishedId()).thenReturn(5L);
        when(questionMapper.countPublishedUpTo(5L)).thenReturn(20L);
        when(questionMapper.selectPublishedBatchAfter(0L, 5L, 20)).thenReturn(List.of(q1, q2));
        when(questionMapper.selectPublishedBatchAfter(5L, 5L, 20)).thenReturn(List.of());
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenReturn(response("""
                {"items":[{"questionId":1,"knowledgePoints":["HashMap 原理"]},
                {"questionId":5,"knowledgePoints":["JVM内存","JVM"]}]}
                """));
        when(persistenceService.persistCleaningBatch(any(), any(), any()))
                .thenReturn(new KnowledgePointPersistenceService.CleaningWriteResult(3, 2));

        KnowledgePointCleaningService.CleanProgress done = service.cleanOnce();

        assertEquals(2, done.processedQuestions(), "进度应按实际游标结果累计");
        assertEquals(3, done.newKnowledgePoints());
        assertEquals(2, done.taggedQuestions());
        ArgumentCaptor<Map<Long, List<String>>> captor = ArgumentCaptor.forClass(Map.class);
        verify(persistenceService).persistCleaningBatch(eq(List.of(q1, q2)), captor.capture(), any());
        assertEquals(List.of("HashMap原理"), captor.getValue().get(1L));
        assertEquals(List.of("JVM内存", "JVM"), captor.getValue().get(5L));
        verify(questionMapper).selectPublishedBatchAfter(5L, 5L, 20);
    }

    @Test
    void retriesWhenAiOmitsQuestionThenAcceptsCompleteResponse() {
        Question q1 = question(1L, 1L, "HashMap");
        Question q2 = question(2L, 1L, "JVM");
        stubQuestionPages(2L, List.of(q1, q2));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000)))
                .thenReturn(response("{\"items\":[{\"questionId\":1,\"knowledgePoints\":[]}]}"))
                .thenReturn(response("""
                        {"items":[{"questionId":1,"knowledgePoints":[]},
                        {"questionId":2,"knowledgePoints":["JVM"]}]}
                        """));

        KnowledgePointCleaningService.CleanProgress done = service.cleanOnce();

        assertEquals(0, done.failedBatches());
        verify(aiHttpClient, times(2)).callSync(anyString(), any(), eq(16384), eq(180000));
        verify(persistenceService).persistCleaningBatch(any(), any(), any());
    }

    @Test
    void skipsAiWhenNoPublishedQuestions() {
        when(questionMapper.selectMaxPublishedId()).thenReturn(null);

        KnowledgePointCleaningService.CleanProgress done = service.cleanOnce();

        verify(aiHttpClient, never()).callSync(anyString(), any(), eq(16384), eq(180000));
        assertEquals(0, done.totalQuestions());
        assertEquals("清洗完成", done.message().substring(0, 4));
    }

    @Test
    void reportsFailedBatchAsCompletedWork() {
        Question question = question(1L, 1L, "HashMap 的原理是什么？");
        stubQuestionPages(1L, List.of(question));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000)))
                .thenThrow(new IllegalStateException("AI unavailable"));

        KnowledgePointCleaningService.CleanProgress done = service.cleanOnce();

        assertEquals(1, done.processedQuestions());
        assertEquals(1, done.failedBatches());
        assertTrue(done.message().contains("失败批次 1"));
        verify(persistenceService, never()).persistCleaningBatch(any(), any(), any());
    }

    @Test
    void rejectsMoreThanThreePointsPerQuestion() {
        Question question = question(1L, 1L, "HashMap");
        stubQuestionPages(1L, List.of(question));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenReturn(response("""
                {"items":[{"questionId":1,"knowledgePoints":["A","B","C","D"]}]}
                """));

        KnowledgePointCleaningService.CleanProgress done = service.cleanOnce();

        assertEquals(1, done.failedBatches());
        verify(persistenceService, never()).persistCleaningBatch(any(), any(), any());
    }

    private void stubQuestionPages(long maxId, List<Question> questions) {
        when(questionMapper.selectMaxPublishedId()).thenReturn(maxId);
        when(questionMapper.countPublishedUpTo(maxId)).thenReturn((long) questions.size());
        when(questionMapper.selectPublishedBatchAfter(0L, maxId, 20)).thenReturn(questions);
        when(questionMapper.selectPublishedBatchAfter(maxId, maxId, 20)).thenReturn(List.of());
    }

    private String response(String content) {
        try {
            return new ObjectMapper().writeValueAsString(Map.of(
                    "choices", List.of(Map.of("message", Map.of("content", content)))));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void waitForIdle() {
        for (int attempt = 0; attempt < 100; attempt += 1) {
            if (!service.getProgress().running()) {
                return;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        throw new AssertionError("清洗任务未在预期时间内结束");
    }

    private Question question(Long id, Long categoryId, String title) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(categoryId);
        question.setTitle(title);
        question.setContent("答案内容");
        question.setStatus("PUBLISHED");
        return question;
    }

    private Category category(Long id, String name) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        return category;
    }
}
