package com.lcbinterview.service;

import com.lcbinterview.dto.tools.LotteryKl8SyncResultVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LotteryKl8SyncServiceTest {

    @Test
    void syncUsesBatchExistingIssueLookupBeforeInsert() {
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8DrawFetcher drawFetcher = mock(LotteryKl8DrawFetcher.class);
        LotteryKl8RecommendationEvaluationService evaluationService = mock(LotteryKl8RecommendationEvaluationService.class);
        LotteryKl8SyncService service = new LotteryKl8SyncService(drawMapper, drawFetcher, evaluationService);
        when(drawFetcher.fetchRecentDraws()).thenReturn(List.of(
                fetched("2026002"),
                fetched("2026001")
        ));
        LotteryKl8Draw existing = new LotteryKl8Draw();
        existing.setIssueNo("2026001");
        when(drawMapper.selectList(any())).thenReturn(List.of(existing));
        when(drawMapper.selectOne(any())).thenReturn(existing);
        when(evaluationService.evaluatePendingRecommendations()).thenReturn(0);

        LotteryKl8SyncResultVO result = service.sync();

        assertEquals(2, result.fetchedCount());
        assertEquals(1, result.insertedCount());
        verify(drawMapper).selectList(any());
        verify(drawMapper, never()).selectCount(any());
        verify(drawMapper).insert(argThat(draw -> "2026002".equals(draw.getIssueNo())));
    }

    private LotteryKl8FetchedDraw fetched(String issueNo) {
        return new LotteryKl8FetchedDraw(
                issueNo,
                LocalDate.of(2026, 6, 29),
                List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20),
                "https://www.zhcw.com/kjxx/kl8/",
                "中彩网快乐8开奖信息");
    }
}
