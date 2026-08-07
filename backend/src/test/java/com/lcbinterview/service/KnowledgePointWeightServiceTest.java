package com.lcbinterview.service;

import com.lcbinterview.mapper.InterviewFeedbackMapper;
import com.lcbinterview.mapper.KnowledgePointMapper;
import com.lcbinterview.mapper.KnowledgePointMentionMapper;
import com.lcbinterview.mapper.QuestionKnowledgePointMapper;
import com.lcbinterview.model.KnowledgePoint;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgePointWeightServiceTest {

    @Test
    void recalculatesCorpusScoresAndMarksSource() {
        KnowledgePointMapper knowledgePointMapper = mock(KnowledgePointMapper.class);
        KnowledgePointMentionMapper mentionMapper = mock(KnowledgePointMentionMapper.class);
        QuestionKnowledgePointMapper relationMapper = mock(QuestionKnowledgePointMapper.class);
        InterviewFeedbackMapper feedbackMapper = mock(InterviewFeedbackMapper.class);

        when(knowledgePointMapper.selectAllIds()).thenReturn(List.of(1L, 2L));
        when(mentionMapper.selectMentionStats()).thenReturn(List.of(
                new KnowledgePointMentionMapper.MentionStat(1L, 15L, 2L),
                new KnowledgePointMentionMapper.MentionStat(2L, 1L, 1L)));
        when(relationMapper.selectRelationCounts()).thenReturn(List.of(
                new QuestionKnowledgePointMapper.IdCount(1L, 2L),
                new QuestionKnowledgePointMapper.IdCount(2L, 1L)));
        when(feedbackMapper.selectFeedbackCounts()).thenReturn(List.of());

        KnowledgePointWeightService service = new KnowledgePointWeightService(
                knowledgePointMapper, mentionMapper, relationMapper, feedbackMapper);
        int updated = service.recalculate();

        assertEquals(2, updated);
        ArgumentCaptor<KnowledgePoint> captor = ArgumentCaptor.forClass(KnowledgePoint.class);
        verify(knowledgePointMapper, org.mockito.Mockito.times(2)).updateById(captor.capture());
        List<KnowledgePoint> updates = captor.getAllValues();
        // HashMap原理 语料频次最高（15 次），应拿到最高分
        KnowledgePoint hotUpdate = updates.stream()
                .filter(item -> item.getId().equals(1L)).findFirst().orElseThrow();
        KnowledgePoint coldUpdate = updates.stream()
                .filter(item -> item.getId().equals(2L)).findFirst().orElseThrow();
        assertEquals("CORPUS", hotUpdate.getHotScoreSource());
        assertTrue(hotUpdate.getHotScore() >= 60, "高频考点得分应显著高于低频考点");
        assertTrue(hotUpdate.getHotScore() > coldUpdate.getHotScore());
        assertTrue(coldUpdate.getHotScore() > 0);
    }

    @Test
    void blendsFeedbackWhenSamplesExist() {
        KnowledgePointMapper knowledgePointMapper = mock(KnowledgePointMapper.class);
        KnowledgePointMentionMapper mentionMapper = mock(KnowledgePointMentionMapper.class);
        QuestionKnowledgePointMapper relationMapper = mock(QuestionKnowledgePointMapper.class);
        InterviewFeedbackMapper feedbackMapper = mock(InterviewFeedbackMapper.class);

        when(knowledgePointMapper.selectAllIds()).thenReturn(List.of(1L));
        when(mentionMapper.selectMentionStats()).thenReturn(List.of(
                new KnowledgePointMentionMapper.MentionStat(1L, 2L, 1L)));
        when(relationMapper.selectRelationCounts()).thenReturn(List.of(
                new QuestionKnowledgePointMapper.IdCount(1L, 1L)));
        when(feedbackMapper.selectFeedbackCounts()).thenReturn(List.of(
                new InterviewFeedbackMapper.IdCount(1L, 10L)));

        KnowledgePointWeightService service = new KnowledgePointWeightService(
                knowledgePointMapper, mentionMapper, relationMapper, feedbackMapper);
        service.recalculate();

        ArgumentCaptor<KnowledgePoint> captor = ArgumentCaptor.forClass(KnowledgePoint.class);
        verify(knowledgePointMapper).updateById(captor.capture());
        assertEquals("BLEND", captor.getValue().getHotScoreSource());
        assertEquals(100, captor.getValue().getHotScore(), "反馈占比 20% 起且反馈为当前最高频时应为满分");
    }

    @Test
    void skipsWhenNoPoints() {
        KnowledgePointMapper knowledgePointMapper = mock(KnowledgePointMapper.class);
        KnowledgePointMentionMapper mentionMapper = mock(KnowledgePointMentionMapper.class);
        QuestionKnowledgePointMapper relationMapper = mock(QuestionKnowledgePointMapper.class);
        InterviewFeedbackMapper feedbackMapper = mock(InterviewFeedbackMapper.class);
        when(knowledgePointMapper.selectAllIds()).thenReturn(List.of());

        KnowledgePointWeightService service = new KnowledgePointWeightService(
                knowledgePointMapper, mentionMapper, relationMapper, feedbackMapper);

        assertEquals(0, service.recalculate());
    }
}
