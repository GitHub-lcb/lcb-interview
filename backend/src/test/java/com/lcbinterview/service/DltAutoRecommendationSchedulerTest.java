package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.DltRecommendationMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.DltDraw;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DltAutoRecommendationSchedulerTest {

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void generatesForActiveUsersWithoutCurrentIssueRecommendation() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        DltDrawMapper drawMapper = mock(DltDrawMapper.class);
        DltRecommendationMapper recommendationMapper = mock(DltRecommendationMapper.class);
        DltRecommendationService recommendationService = mock(DltRecommendationService.class);

        AppUser user = new AppUser();
        user.setId(1L);
        user.setStatus("ACTIVE");
        DltDraw draw = new DltDraw();
        draw.setIssueNo("26092");

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw);
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user));
        when(recommendationMapper.selectCount(any(Wrapper.class))).thenReturn(0L);

        DltAutoRecommendationScheduler scheduler = new DltAutoRecommendationScheduler(
                userMapper, drawMapper, recommendationMapper, recommendationService);
        scheduler.recommendForLatestDraw();

        verify(recommendationService).recommend(eq(1L), any());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void skipsUsersWhoAlreadyHaveRecommendation() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        DltDrawMapper drawMapper = mock(DltDrawMapper.class);
        DltRecommendationMapper recommendationMapper = mock(DltRecommendationMapper.class);
        DltRecommendationService recommendationService = mock(DltRecommendationService.class);

        AppUser user = new AppUser();
        user.setId(1L);
        user.setStatus("ACTIVE");
        DltDraw draw = new DltDraw();
        draw.setIssueNo("26092");

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw);
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user));
        when(recommendationMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        DltAutoRecommendationScheduler scheduler = new DltAutoRecommendationScheduler(
                userMapper, drawMapper, recommendationMapper, recommendationService);
        scheduler.recommendForLatestDraw();

        verify(recommendationService, never()).recommend(any(), any());
    }
}
