package com.lcbinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.InterviewSourceMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.InterviewSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgePointCorpusServiceTest {

    private InterviewSourceMapper interviewSourceMapper;
    private CategoryMapper categoryMapper;
    private KnowledgePointPersistenceService persistenceService;
    private AiRuntimeConfigService aiRuntimeConfigService;
    private AiHttpClient aiHttpClient;
    private KnowledgePointCorpusService service;

    @BeforeEach
    void setUp() {
        interviewSourceMapper = mock(InterviewSourceMapper.class);
        categoryMapper = mock(CategoryMapper.class);
        persistenceService = mock(KnowledgePointPersistenceService.class);
        aiRuntimeConfigService = mock(AiRuntimeConfigService.class);
        aiHttpClient = mock(AiHttpClient.class);
        service = new KnowledgePointCorpusService(
                interviewSourceMapper, categoryMapper, persistenceService,
                aiRuntimeConfigService, aiHttpClient, new ObjectMapper());
        when(categoryMapper.selectList(null)).thenReturn(List.of(category(1L, "Java 基础")));
        when(aiRuntimeConfigService.current()).thenReturn(new AiRuntimeConfig(
                "test-key", "test-model", "https://test/api", true));
        when(persistenceService.persistCorpusBatch(any(), any()))
                .thenReturn(new KnowledgePointPersistenceService.CorpusWriteResult(2, 2));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void validatesCategoryAndMarksExplicitEmptySourceExtracted() {
        InterviewSource s1 = source(1L, "第一篇面经");
        InterviewSource s2 = source(2L, "第二篇面经");
        stubSourcePages(2L, List.of(s1, s2));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenReturn(response("""
                {"items":[
                  {"sourceId":1,"company":"示例公司","position":"Java后端","knowledgePoints":[
                    {"categoryId":1,"name":"HashMap 原理","mentionCount":2,"context":"扩容"},
                    {"categoryId":1,"name":"JVM内存","mentionCount":1,"context":"内存区域"}]},
                  {"sourceId":2,"company":"","position":"","knowledgePoints":[]}]}
                """));

        KnowledgePointCorpusService.ExtractProgress done = service.extractOnce();

        assertEquals(2, done.processedSources());
        assertEquals(2, done.newMentions());
        assertEquals(0, done.failedBatches());
        ArgumentCaptor<List<KnowledgePointPersistenceService.CorpusSourceWrite>> captor =
                ArgumentCaptor.forClass(List.class);
        verify(persistenceService).persistCorpusBatch(eq(List.of(s1, s2)), captor.capture());
        assertEquals(2, captor.getValue().size());
        assertEquals(1L, captor.getValue().get(0).mentions().get(0).categoryId());
        assertEquals("HashMap原理", captor.getValue().get(0).mentions().get(0).pointName());
        assertEquals(0, captor.getValue().get(1).mentions().size());
    }

    @Test
    void retriesMissingSourceThenSucceeds() {
        InterviewSource s1 = source(1L, "第一篇");
        InterviewSource s2 = source(2L, "第二篇");
        stubSourcePages(2L, List.of(s1, s2));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000)))
                .thenReturn(response("{\"items\":[{\"sourceId\":1,\"knowledgePoints\":[]}]}"))
                .thenReturn(response("""
                        {"items":[{"sourceId":1,"knowledgePoints":[]},
                        {"sourceId":2,"knowledgePoints":[]}]}
                        """));

        KnowledgePointCorpusService.ExtractProgress done = service.extractOnce();

        assertEquals(0, done.failedBatches());
        verify(aiHttpClient, times(2)).callSync(anyString(), any(), eq(16384), eq(180000));
        verify(persistenceService).persistCorpusBatch(any(), any());
    }

    @Test
    void rejectsForeignOrUnknownCategoryAndMarksWholeBatchFailed() {
        InterviewSource source = source(1L, "第一篇");
        stubSourcePages(1L, List.of(source));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenReturn(response("""
                {"items":[{"sourceId":999,"knowledgePoints":[
                {"categoryId":999,"name":"HashMap","mentionCount":1}]}]}
                """));

        KnowledgePointCorpusService.ExtractProgress done = service.extractOnce();

        assertEquals(1, done.processedSources());
        assertEquals(1, done.failedBatches());
        verify(aiHttpClient, times(3)).callSync(anyString(), any(), eq(16384), eq(180000));
        verify(persistenceService, never()).persistCorpusBatch(any(), any());
        verify(persistenceService).markCorpusBatchFailed(eq(List.of(source)), anyString());
    }

    @Test
    void rejectsDuplicateSourceId() {
        InterviewSource s1 = source(1L, "第一篇");
        InterviewSource s2 = source(2L, "第二篇");
        stubSourcePages(2L, List.of(s1, s2));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenReturn(response("""
                {"items":[{"sourceId":1,"knowledgePoints":[]},
                {"sourceId":1,"knowledgePoints":[]}]}
                """));

        KnowledgePointCorpusService.ExtractProgress done = service.extractOnce();

        assertEquals(1, done.failedBatches());
        verify(persistenceService, never()).persistCorpusBatch(any(), any());
    }

    @Test
    void rejectsTooManyPointsOrUnboundedMentionCount() {
        InterviewSource source = source(1L, "第一篇");
        stubSourcePages(1L, List.of(source));
        when(aiHttpClient.callSync(anyString(), any(), eq(16384), eq(180000))).thenReturn(response("""
                {"items":[{"sourceId":1,"knowledgePoints":[
                {"categoryId":1,"name":"A","mentionCount":21},
                {"categoryId":1,"name":"B","mentionCount":1},
                {"categoryId":1,"name":"C","mentionCount":1},
                {"categoryId":1,"name":"D","mentionCount":1},
                {"categoryId":1,"name":"E","mentionCount":1},
                {"categoryId":1,"name":"F","mentionCount":1},
                {"categoryId":1,"name":"G","mentionCount":1},
                {"categoryId":1,"name":"H","mentionCount":1},
                {"categoryId":1,"name":"I","mentionCount":1}]}]}
                """));

        KnowledgePointCorpusService.ExtractProgress done = service.extractOnce();

        assertEquals(1, done.failedBatches());
        verify(persistenceService, never()).persistCorpusBatch(any(), any());
    }

    @Test
    void importItemsUsesAtomicDuplicateIgnoreAndValidatesBounds() {
        when(interviewSourceMapper.insertIgnore(any())).thenReturn(0);
        KnowledgePointCorpusService.CorpusItem item = new KnowledgePointCorpusService.CorpusItem(
                " https://a/b ", "juejin", "", "", null, "内容");

        assertEquals(0, service.importItems(List.of(item)));
        ArgumentCaptor<InterviewSource> captor = ArgumentCaptor.forClass(InterviewSource.class);
        verify(interviewSourceMapper).insertIgnore(captor.capture());
        assertEquals("https://a/b", captor.getValue().getSourceUrl());

        List<KnowledgePointCorpusService.CorpusItem> tooMany = java.util.Collections.nCopies(
                KnowledgePointCorpusService.MAX_IMPORT_ITEMS + 1, item);
        assertThrows(BusinessException.class, () -> service.importItems(tooMany));
    }

    private void stubSourcePages(long maxId, List<InterviewSource> sources) {
        when(interviewSourceMapper.selectMaxPendingId()).thenReturn(maxId);
        when(interviewSourceMapper.countPendingUpTo(maxId)).thenReturn((long) sources.size());
        when(interviewSourceMapper.selectPendingBatchAfter(0L, maxId, 10)).thenReturn(sources);
        when(interviewSourceMapper.selectPendingBatchAfter(maxId, maxId, 10)).thenReturn(List.of());
    }

    private String response(String content) {
        try {
            return new ObjectMapper().writeValueAsString(Map.of(
                    "choices", List.of(Map.of("message", Map.of("content", content)))));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private InterviewSource source(Long id, String content) {
        InterviewSource source = new InterviewSource();
        source.setId(id);
        source.setRawContent(content);
        source.setStatus("RAW");
        return source;
    }

    private Category category(Long id, String name) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        return category;
    }
}
