package com.lcbinterview.service;

import com.lcbinterview.mapper.InterviewSourceMapper;
import com.lcbinterview.mapper.KnowledgePointMapper;
import com.lcbinterview.mapper.KnowledgePointMentionMapper;
import com.lcbinterview.mapper.QuestionKnowledgePointMapper;
import com.lcbinterview.mapper.QuestionTagMapper;
import com.lcbinterview.mapper.TagMapper;
import com.lcbinterview.model.InterviewSource;
import com.lcbinterview.model.KnowledgePoint;
import com.lcbinterview.model.KnowledgePointMention;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgePointPersistenceServiceTest {

    private KnowledgePointMapper knowledgePointMapper;
    private KnowledgePointMentionMapper mentionMapper;
    private QuestionKnowledgePointMapper relationMapper;
    private QuestionTagMapper questionTagMapper;
    private TagMapper tagMapper;
    private InterviewSourceMapper sourceMapper;
    private KnowledgePointPersistenceService service;

    @BeforeEach
    void setUp() {
        knowledgePointMapper = mock(KnowledgePointMapper.class);
        mentionMapper = mock(KnowledgePointMentionMapper.class);
        relationMapper = mock(QuestionKnowledgePointMapper.class);
        questionTagMapper = mock(QuestionTagMapper.class);
        tagMapper = mock(TagMapper.class);
        sourceMapper = mock(InterviewSourceMapper.class);
        service = new KnowledgePointPersistenceService(
                knowledgePointMapper, mentionMapper, relationMapper,
                questionTagMapper, tagMapper, sourceMapper);

        AtomicLong pointId = new AtomicLong(100);
        when(knowledgePointMapper.upsertPoint(any())).thenAnswer(invocation -> {
            KnowledgePoint point = invocation.getArgument(0);
            point.setId(pointId.getAndIncrement());
            return 1;
        });
    }

    @Test
    void corpusBatchReusesCategoryPointAndAdvancesSourcesLast() throws Exception {
        InterviewSource s1 = source(1L);
        InterviewSource s2 = source(2L);
        List<KnowledgePointPersistenceService.CorpusSourceWrite> writes = List.of(
                new KnowledgePointPersistenceService.CorpusSourceWrite(1L, "A公司", "Java后端", List.of(
                        new KnowledgePointPersistenceService.CorpusMentionWrite(1L, "HashMap原理", 2, "扩容"))),
                new KnowledgePointPersistenceService.CorpusSourceWrite(2L, "B公司", "Java后端", List.of(
                        new KnowledgePointPersistenceService.CorpusMentionWrite(1L, "HashMap原理", 1, "并发"))));
        when(mentionMapper.upsertMention(any())).thenReturn(1);
        when(sourceMapper.markExtracted(any(), any(), any())).thenReturn(1);

        KnowledgePointPersistenceService.CorpusWriteResult result =
                service.persistCorpusBatch(List.of(s1, s2), writes);

        assertEquals(1, result.newKnowledgePoints());
        assertEquals(2, result.newMentions());
        ArgumentCaptor<KnowledgePoint> pointCaptor = ArgumentCaptor.forClass(KnowledgePoint.class);
        verify(knowledgePointMapper).upsertPoint(pointCaptor.capture());
        assertEquals(1L, pointCaptor.getValue().getCategoryId());
        assertEquals("HashMap原理", pointCaptor.getValue().getName());
        assertTrue(pointCaptor.getValue().getSlug().startsWith("kp-"));

        ArgumentCaptor<KnowledgePointMention> mentionCaptor =
                ArgumentCaptor.forClass(KnowledgePointMention.class);
        verify(mentionMapper, times(2)).upsertMention(mentionCaptor.capture());
        assertEquals(mentionCaptor.getAllValues().get(0).getKnowledgePointId(),
                mentionCaptor.getAllValues().get(1).getKnowledgePointId());
        assertNotNull(mentionCaptor.getAllValues().get(0).getKnowledgePointId());

        InOrder order = inOrder(mentionMapper, sourceMapper);
        order.verify(mentionMapper, times(2)).upsertMention(any());
        order.verify(sourceMapper).markExtracted(1L, "A公司", "Java后端");
        order.verify(sourceMapper).markExtracted(2L, "B公司", "Java后端");
    }

    @Test
    void cleaningBatchUsesAtomicRelationInsert() {
        Question q1 = question(1L, 1L);
        Question q2 = question(2L, 1L);
        when(tagMapper.selectList(any())).thenReturn(List.of());
        when(questionTagMapper.selectCount(any())).thenReturn(0L);

        KnowledgePointPersistenceService.CleaningWriteResult result = service.persistCleaningBatch(
                List.of(q1, q2), Map.of(1L, List.of("HashMap 原理"), 2L, List.of("HashMap原理")),
                Map.of(1L, "Java 基础"));

        assertEquals(1, result.newKnowledgePoints());
        verify(relationMapper).deleteAiByQuestionIds(List.of(1L, 2L));
        verify(knowledgePointMapper).upsertPoint(any());
        verify(relationMapper).insertIgnore(1L, 100L);
        verify(relationMapper).insertIgnore(2L, 100L);
    }

    @Test
    void publicBatchWritesAreTransactional() throws Exception {
        assertNotNull(KnowledgePointPersistenceService.class
                .getMethod("persistCleaningBatch", List.class, Map.class, Map.class)
                .getAnnotation(Transactional.class));
        assertNotNull(KnowledgePointPersistenceService.class
                .getMethod("persistCorpusBatch", List.class, List.class)
                .getAnnotation(Transactional.class));
        assertNotNull(KnowledgePointPersistenceService.class
                .getMethod("markCorpusBatchFailed", List.class, String.class)
                .getAnnotation(Transactional.class));
    }

    private InterviewSource source(Long id) {
        InterviewSource source = new InterviewSource();
        source.setId(id);
        source.setStatus("RAW");
        return source;
    }

    private Question question(Long id, Long categoryId) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(categoryId);
        return question;
    }
}
