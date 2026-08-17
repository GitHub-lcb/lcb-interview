package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.mapper.SsqRecommendationMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.SsqDraw;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SsqAutoRecommendationSchedulerTest {

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void generatesForActiveUsersWithoutCurrentIssueRecommendation() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        SsqDrawMapper drawMapper = mock(SsqDrawMapper.class);
        SsqRecommendationMapper recommendationMapper = mock(SsqRecommendationMapper.class);
        SsqRecommendationService recommendationService = mock(SsqRecommendationService.class);

        AppUser user = new AppUser();
        user.setId(1L);
        user.setStatus("ACTIVE");
        SsqDraw draw = new SsqDraw();
        draw.setIssueNo("2026094");

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw);
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user));
        when(recommendationMapper.selectCount(any(Wrapper.class))).thenReturn(0L);

        SsqAutoRecommendationScheduler scheduler = new SsqAutoRecommendationScheduler(
                userMapper, drawMapper, recommendationMapper, recommendationService);
        scheduler.recommendForLatestDraw();

        verify(recommendationService).recommend(eq(1L), any());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void skipsUsersWhoAlreadyHaveRecommendation() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        SsqDrawMapper drawMapper = mock(SsqDrawMapper.class);
        SsqRecommendationMapper recommendationMapper = mock(SsqRecommendationMapper.class);
        SsqRecommendationService recommendationService = mock(SsqRecommendationService.class);

        AppUser user = new AppUser();
        user.setId(1L);
        user.setStatus("ACTIVE");
        SsqDraw draw = new SsqDraw();
        draw.setIssueNo("2026094");

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw);
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user));
        when(recommendationMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        SsqAutoRecommendationScheduler scheduler = new SsqAutoRecommendationScheduler(
                userMapper, drawMapper, recommendationMapper, recommendationService);
        scheduler.recommendForLatestDraw();

        verify(recommendationService, never()).recommend(any(), any());
    }
}
