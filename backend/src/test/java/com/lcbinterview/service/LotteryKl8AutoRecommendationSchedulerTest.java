package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.LotteryKl8Draw;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LotteryKl8AutoRecommendationSchedulerTest {

    private AppUser user(Long id) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setStatus("ACTIVE");
        return user;
    }

    private LotteryKl8Draw draw(String issueNo) {
        LotteryKl8Draw draw = new LotteryKl8Draw();
        draw.setIssueNo(issueNo);
        return draw;
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void generatesForActiveUsersWithoutCurrentIssueRecommendation() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8RecommendationService recommendationService = mock(LotteryKl8RecommendationService.class);

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw("2026213"));
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user(1L), user(2L)));
        when(recommendationMapper.selectCount(any(Wrapper.class))).thenReturn(0L, 1L);

        LotteryKl8AutoRecommendationScheduler scheduler = new LotteryKl8AutoRecommendationScheduler(
                userMapper, drawMapper, recommendationMapper, recommendationService);
        scheduler.autoRecommendDaily();

        // 用户 1 没有该期推荐所以生成，用户 2 已有该期推荐所以跳过
        verify(recommendationService).recommend(eq(1L), any(LotteryKl8RecommendationRequest.class));
        verify(recommendationService, never()).recommend(eq(2L), any(LotteryKl8RecommendationRequest.class));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void skipsWhenNoDrawData() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationMapper recommendationMapper = mock(LotteryKl8RecommendationMapper.class);
        LotteryKl8RecommendationService recommendationService = mock(LotteryKl8RecommendationService.class);

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(null);

        LotteryKl8AutoRecommendationScheduler scheduler = new LotteryKl8AutoRecommendationScheduler(
                userMapper, drawMapper, recommendationMapper, recommendationService);
        scheduler.autoRecommendDaily();

        verify(recommendationService, never()).recommend(any(), any());
    }
}
