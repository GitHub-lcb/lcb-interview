package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
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
    void generatesForActiveUsersWithoutCurrentFormatRecommendation() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationService recommendationService = mock(LotteryKl8RecommendationService.class);

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw("2026213"));
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user(1L), user(2L)));
        // 用户 1 没有同口径推荐，用户 2 已有
        when(recommendationService.hasCurrentRecommendation(1L, "2026213")).thenReturn(false);
        when(recommendationService.hasCurrentRecommendation(2L, "2026213")).thenReturn(true);

        LotteryKl8AutoRecommendationScheduler scheduler = new LotteryKl8AutoRecommendationScheduler(
                userMapper, drawMapper, recommendationService);
        int generated = scheduler.autoRecommendDaily();

        verify(recommendationService).recommend(eq(1L), any(LotteryKl8RecommendationRequest.class));
        verify(recommendationService, never()).recommend(eq(2L), any(LotteryKl8RecommendationRequest.class));
        // 返回值供后台运维接口展示实际生成条数
        assertEquals(1, generated);
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void regeneratesWhenExistingRecordUsesLegacyFormat() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationService recommendationService = mock(LotteryKl8RecommendationService.class);

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw("2026213"));
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user(7L)));
        // 该期存在旧选4 记录：hasCurrentRecommendation 返回 false，调度器必须补生成选5
        when(recommendationService.hasCurrentRecommendation(7L, "2026213")).thenReturn(false);

        LotteryKl8AutoRecommendationScheduler scheduler = new LotteryKl8AutoRecommendationScheduler(
                userMapper, drawMapper, recommendationService);
        scheduler.autoRecommendDaily();

        verify(recommendationService).recommend(eq(7L), any(LotteryKl8RecommendationRequest.class));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void skipsWhenNoDrawData() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationService recommendationService = mock(LotteryKl8RecommendationService.class);

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(null);

        LotteryKl8AutoRecommendationScheduler scheduler = new LotteryKl8AutoRecommendationScheduler(
                userMapper, drawMapper, recommendationService);
        scheduler.autoRecommendDaily();

        verify(recommendationService, never()).recommend(any(), any());
        verify(userMapper, never()).selectList(any(Wrapper.class));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void countsOnlySuccessfullyGeneratedRecommendations() {
        AppUserMapper userMapper = mock(AppUserMapper.class);
        LotteryKl8DrawMapper drawMapper = mock(LotteryKl8DrawMapper.class);
        LotteryKl8RecommendationService recommendationService = mock(LotteryKl8RecommendationService.class);

        when(drawMapper.selectOne(any(Wrapper.class))).thenReturn(draw("2026213"));
        when(userMapper.selectList(any(Wrapper.class))).thenReturn(List.of(user(1L), user(2L)));
        when(recommendationService.hasCurrentRecommendation(any(), eq("2026213"))).thenReturn(false);
        when(recommendationService.recommend(eq(1L), any(LotteryKl8RecommendationRequest.class)))
                .thenReturn(null);
        when(recommendationService.recommend(eq(2L), any(LotteryKl8RecommendationRequest.class)))
                .thenThrow(new IllegalStateException("历史开奖数据不足"));

        LotteryKl8AutoRecommendationScheduler scheduler = new LotteryKl8AutoRecommendationScheduler(
                userMapper, drawMapper, recommendationService);
        scheduler.autoRecommendDaily();

        // 单个用户失败不能中断其余用户
        verify(recommendationService).recommend(eq(1L), any(LotteryKl8RecommendationRequest.class));
        verify(recommendationService).recommend(eq(2L), any(LotteryKl8RecommendationRequest.class));
    }
}
