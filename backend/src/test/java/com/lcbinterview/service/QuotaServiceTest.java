package com.lcbinterview.service;

import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.UserQuotaLogMapper;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 配额闸门服务测试，覆盖免费额度、积分抵扣、会员专属、跨天重置和 Redis 降级。
 */
class QuotaServiceTest {

    private static final Long USER_ID = 1L;
    private static final Clock DAY_ONE = Clock.fixed(Instant.parse("2026-08-20T02:00:00Z"), ZoneOffset.UTC);
    private static final Clock DAY_TWO = Clock.fixed(Instant.parse("2026-08-21T02:00:00Z"), ZoneOffset.UTC);

    private MembershipService membershipService;
    private CreditService creditService;
    private UserQuotaLogMapper quotaLogMapper;
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOps;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        membershipService = mock(MembershipService.class);
        creditService = mock(CreditService.class);
        quotaLogMapper = mock(UserQuotaLogMapper.class);
        redisTemplate = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    private QuotaService service(Clock clock, boolean enabled) {
        return new QuotaService(membershipService, creditService, quotaLogMapper, redisTemplate, clock, enabled);
    }

    @Test
    void disabledQuotaWallPassesEverything() {
        QuotaService quotaService = service(DAY_ONE, false);

        quotaService.ensureAvailable(USER_ID, Resource.AI_EVALUATE);
        quotaService.consume(USER_ID, Resource.AI_EVALUATE);

        verifyNoInteractions(membershipService, creditService, quotaLogMapper, redisTemplate);
    }

    @Test
    void freeUserWithinQuotaConsumesCounterOnly() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        when(valueOps.increment(anyString())).thenReturn(2L);
        QuotaService quotaService = service(DAY_ONE, true);

        quotaService.consume(USER_ID, Resource.AI_EVALUATE);

        verify(quotaLogMapper).incrementUsage(eq(USER_ID), eq("AI_EVALUATE"), eq(LocalDate.of(2026, 8, 20)));
        verify(creditService, never()).consume(any(), eq(1), any(), any(), any());
    }

    @Test
    void ensureAvailableThrowsWhenQuotaExhaustedWithoutCredits() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        when(valueOps.get(anyString())).thenReturn("3");
        when(creditService.balance(USER_ID)).thenReturn(0);
        QuotaService quotaService = service(DAY_ONE, true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> quotaService.ensureAvailable(USER_ID, Resource.AI_EVALUATE));

        assertEquals(BillingErrorCodes.QUOTA_EXHAUSTED, e.getCode());
    }

    @Test
    void ensureAvailablePassesWhenQuotaExhaustedButCreditsAvailable() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        when(valueOps.get(anyString())).thenReturn("3");
        when(creditService.balance(USER_ID)).thenReturn(5);
        QuotaService quotaService = service(DAY_ONE, true);

        quotaService.ensureAvailable(USER_ID, Resource.AI_EVALUATE);
    }

    @Test
    void consumeOverQuotaDeductsCredits() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        // FREE AI_EVALUATE 每日 3 次，第 4 次越过上限
        when(valueOps.increment(anyString())).thenReturn(4L);
        QuotaService quotaService = service(DAY_ONE, true);

        quotaService.consume(USER_ID, Resource.AI_EVALUATE);

        verify(valueOps).decrement(anyString());
        verify(creditService).consume(eq(USER_ID), eq(1), eq("AI_EVALUATE"), any(), any());
    }

    @Test
    void consumeOverQuotaWithoutCreditsThrowsQuotaExhausted() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        when(valueOps.increment(anyString())).thenReturn(4L);
        when(creditService.balance(USER_ID)).thenReturn(0);
        org.mockito.Mockito.doThrow(new BusinessException(BillingErrorCodes.CREDIT_INSUFFICIENT, "AI 积分不足"))
                .when(creditService).consume(eq(USER_ID), eq(1), eq("AI_EVALUATE"), any(), any());
        QuotaService quotaService = service(DAY_ONE, true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> quotaService.consume(USER_ID, Resource.AI_EVALUATE));

        // 积分不足统一转述为额度耗尽，前端按 40301 弹升级/充值引导
        assertEquals(BillingErrorCodes.QUOTA_EXHAUSTED, e.getCode());
    }

    @Test
    void freeUserCannotAccessProOnlyResource() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        QuotaService quotaService = service(DAY_ONE, true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> quotaService.ensureAvailable(USER_ID, Resource.PREMIUM_EXPORT));

        assertEquals(BillingErrorCodes.MEMBER_REQUIRED, e.getCode());
    }

    @Test
    void proUnlimitedResourceSkipsCounter() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("PRO");
        QuotaService quotaService = service(DAY_ONE, true);

        quotaService.ensureAvailable(USER_ID, Resource.ANSWER_DETAIL);
        quotaService.consume(USER_ID, Resource.ANSWER_DETAIL);

        verifyNoInteractions(redisTemplate, quotaLogMapper);
        assertEquals(MembershipQuotaPolicy.UNLIMITED, quotaService.remainingOfDay(USER_ID, Resource.ANSWER_DETAIL));
    }

    @Test
    void redisFailureFallsBackToDatabaseLog() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        when(valueOps.increment(anyString()))
                .thenThrow(new RedisConnectionFailureException("redis down"));
        when(quotaLogMapper.selectUsage(eq(USER_ID), eq("AI_EVALUATE"), any())).thenReturn(1);
        QuotaService quotaService = service(DAY_ONE, true);

        quotaService.consume(USER_ID, Resource.AI_EVALUATE);

        verify(quotaLogMapper).incrementUsage(eq(USER_ID), eq("AI_EVALUATE"), eq(LocalDate.of(2026, 8, 20)));
        verify(creditService, never()).consume(any(), eq(1), any(), any(), any());
    }

    @Test
    void quotaCounterKeyResetsAcrossDays() {
        when(membershipService.resolveLevel(USER_ID)).thenReturn("FREE");
        QuotaService dayOneService = service(DAY_ONE, true);
        QuotaService dayTwoService = service(DAY_TWO, true);

        dayOneService.usageOfDay(USER_ID, Resource.AI_EVALUATE);
        dayTwoService.usageOfDay(USER_ID, Resource.AI_EVALUATE);

        // 计数键按服务端日期隔离，跨天自然重置，无需主动清理
        verify(valueOps).get(contains("20260820"));
        verify(valueOps).get(contains("20260821"));
    }
}
