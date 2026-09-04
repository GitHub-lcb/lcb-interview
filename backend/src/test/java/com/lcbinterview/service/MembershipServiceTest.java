package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.MembershipPlanMapper;
import com.lcbinterview.mapper.UserMembershipMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.MembershipPlan;
import com.lcbinterview.model.UserMembership;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 会员服务测试，覆盖等级判定、惰性过期、开通续期叠加和冗余列同步。
 */
class MembershipServiceTest {

    private static final Long USER_ID = 1L;
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-08-20T02:00:00Z"), ZoneOffset.UTC);
    private static final LocalDateTime NOW = LocalDateTime.now(FIXED_CLOCK);

    private UserMembershipMapper membershipMapper;
    private MembershipPlanMapper planMapper;
    private AppUserMapper appUserMapper;
    private MembershipService membershipService;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), UserMembership.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), MembershipPlan.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), AppUser.class);
        membershipMapper = mock(UserMembershipMapper.class);
        planMapper = mock(MembershipPlanMapper.class);
        appUserMapper = mock(AppUserMapper.class);
        membershipService = new MembershipService(membershipMapper, planMapper, appUserMapper, FIXED_CLOCK);
    }

    private UserMembership activeMembership(LocalDateTime expireTime) {
        UserMembership membership = new UserMembership();
        membership.setId(10L);
        membership.setUserId(USER_ID);
        membership.setPlanCode("PRO_MONTHLY");
        membership.setStartTime(expireTime.minusDays(30));
        membership.setExpireTime(expireTime);
        membership.setStatus(UserMembership.STATUS_ACTIVE);
        return membership;
    }

    @Test
    void resolveLevelReturnsFreeWithoutMembership() {
        when(membershipMapper.selectOne(any())).thenReturn(null);

        assertEquals(MembershipQuotaPolicy.LEVEL_FREE, membershipService.resolveLevel(USER_ID));
        // 游客无 userId 时不查库，直接按 FREE
        assertEquals(MembershipQuotaPolicy.LEVEL_FREE, membershipService.resolveLevel(null));
    }

    @Test
    void resolveLevelReturnsProWithActiveMembership() {
        when(membershipMapper.selectOne(any())).thenReturn(activeMembership(NOW.plusDays(5)));

        assertEquals(MembershipQuotaPolicy.LEVEL_PRO, membershipService.resolveLevel(USER_ID));
    }

    @Test
    void findActiveMembershipLazilyExpiresAndSyncsLevelColumn() {
        UserMembership overdue = activeMembership(NOW.minusMinutes(1));
        when(membershipMapper.selectOne(any())).thenReturn(overdue);

        assertNull(membershipService.findActiveMembership(USER_ID));

        assertEquals(UserMembership.STATUS_EXPIRED, overdue.getStatus());
        verify(membershipMapper).updateById(overdue);
        // 冗余列同步降级为 FREE，避免列表页继续展示 VIP 标识
        ArgumentCaptor<AppUser> captor = ArgumentCaptor.forClass(AppUser.class);
        verify(appUserMapper).updateById(captor.capture());
        assertEquals(MembershipQuotaPolicy.LEVEL_FREE, captor.getValue().getMembershipLevel());
    }

    @Test
    void activateCreatesNewMembershipFromNow() {
        when(membershipMapper.selectOne(any())).thenReturn(null);

        UserMembership membership = membershipService.activateOrExtend(USER_ID, "PRO_MONTHLY", 30);

        assertEquals(NOW, membership.getStartTime());
        assertEquals(NOW.plusDays(30), membership.getExpireTime());
        assertEquals(UserMembership.STATUS_ACTIVE, membership.getStatus());
        verify(membershipMapper).insert(membership);
        ArgumentCaptor<AppUser> captor = ArgumentCaptor.forClass(AppUser.class);
        verify(appUserMapper).updateById(captor.capture());
        assertEquals(MembershipQuotaPolicy.LEVEL_PRO, captor.getValue().getMembershipLevel());
    }

    @Test
    void activateExtendsExistingMembershipOnExpireTime() {
        UserMembership active = activeMembership(NOW.plusDays(5));
        when(membershipMapper.selectOne(any())).thenReturn(active);

        UserMembership membership = membershipService.activateOrExtend(USER_ID, "PRO_YEARLY", 365);

        // 续期在剩余有效期上叠加，而不是从当前时间重新计算
        assertEquals(NOW.plusDays(5 + 365), membership.getExpireTime());
        assertEquals("PRO_YEARLY", membership.getPlanCode());
        verify(membershipMapper).updateById(active);
        verify(membershipMapper, never()).insert(any());
    }

    @Test
    void expireOverdueMembershipsBatchRecyclesAndSyncsLevel() {
        UserMembership overdue = activeMembership(NOW.minusHours(1));
        when(membershipMapper.selectList(any())).thenReturn(List.of(overdue));

        membershipService.expireOverdueMemberships();

        assertEquals(UserMembership.STATUS_EXPIRED, overdue.getStatus());
        verify(membershipMapper).updateById(overdue);
        ArgumentCaptor<AppUser> captor = ArgumentCaptor.forClass(AppUser.class);
        verify(appUserMapper).updateById(captor.capture());
        assertEquals(MembershipQuotaPolicy.LEVEL_FREE, captor.getValue().getMembershipLevel());
    }

    @Test
    void expireOverdueMembershipsSkipsWhenNothingOverdue() {
        when(membershipMapper.selectList(any())).thenReturn(List.of());

        membershipService.expireOverdueMemberships();

        verify(membershipMapper, never()).updateById(any());
        verify(appUserMapper, never()).updateById(any());
    }
}
