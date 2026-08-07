package com.lcbinterview.service;

import com.lcbinterview.dto.KnowledgePointVO;
import com.lcbinterview.mapper.KnowledgePointMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgePointServiceTest {

    @Test
    void mapsHotPointRowsToVo() {
        KnowledgePointMapper mapper = mock(KnowledgePointMapper.class);
        when(mapper.selectHotPoints(null, 20)).thenReturn(List.of(
                new KnowledgePointMapper.HotPointRow(1L, "HashMap原理", 1L, "Java 基础",
                        95, "CORPUS", 15L, 6L, 8L)));

        KnowledgePointService service = new KnowledgePointService(mapper);
        List<KnowledgePointVO> points = service.hotPoints(null, 20);

        assertEquals(1, points.size());
        KnowledgePointVO vo = points.getFirst();
        assertEquals("HashMap原理", vo.name());
        assertEquals("Java 基础", vo.categoryName());
        assertEquals(95, vo.hotScore());
        assertEquals(15L, vo.mentionTotal());
        assertEquals(6L, vo.docCount());
        assertEquals(8L, vo.questionCount());
        verify(mapper).selectHotPoints(null, 20);
    }

    @Test
    void clampsSizeWithinBounds() {
        KnowledgePointMapper mapper = mock(KnowledgePointMapper.class);
        when(mapper.selectHotPoints(3L, 100)).thenReturn(List.of());

        KnowledgePointService service = new KnowledgePointService(mapper);
        assertTrue(service.hotPoints(3L, 999).isEmpty());
        verify(mapper).selectHotPoints(3L, 100);
    }
}
