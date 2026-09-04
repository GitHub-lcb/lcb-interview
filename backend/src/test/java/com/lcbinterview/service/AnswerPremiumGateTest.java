package com.lcbinterview.service;

import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 答案会员墙闸门测试，覆盖开关放行、游客锁定、PRO 直通和 FREE 配额消耗。
 */
class AnswerPremiumGateTest {

    private static final Long USER_ID = 1L;

    private MembershipService membershipService;
    private QuotaService quotaService;
    private AnswerPremiumGate gate;

    @BeforeEach
    void setUp() {
        membershipService = mock(MembershipService.class);
        quotaService = mock(QuotaService.class);
        gate = new AnswerPremiumGate(membershipService, quotaService);
    }

    private QuestionVO fullDetail() {
        return new QuestionVO(
                1L, "HashMap 原理", "摘要", "正文",
                "原理解析", "对比分析", "适用场景", "风险避坑",
                "项目实战", "代码示例", "图解", "2,3",
                "MEDIUM", 10L, "Java 集合", List.of("HashMap"),
                100, LocalDateTime.now(), null, null, false
        );
    }

    @Test
    void disabledGateReturnsFullDetail() {
        when(quotaService.isEnabled()).thenReturn(false);

        QuestionVO result = gate.apply(fullDetail(), USER_ID);

        assertFalse(result.premiumLocked());
        assertEquals("原理解析", result.principle());
        verifyNoInteractions(membershipService);
        verify(quotaService, never()).consume(any(), any());
    }

    @Test
    void guestGetsLockedDetailWithoutQuotaConsumption() {
        when(quotaService.isEnabled()).thenReturn(true);

        QuestionVO result = gate.apply(fullDetail(), null);

        assertTrue(result.premiumLocked());
        assertNull(result.principle());
        assertNull(result.codeExamples());
        // 摘要、正文、风险字段对游客保持公开
        assertEquals("摘要", result.summary());
        assertEquals("正文", result.content());
        assertEquals("风险避坑", result.risk());
        verify(quotaService, never()).consume(any(), any());
    }

    @Test
    void proMemberGetsFullDetailWithoutQuotaConsumption() {
        when(quotaService.isEnabled()).thenReturn(true);
        when(membershipService.resolveLevel(USER_ID)).thenReturn(MembershipQuotaPolicy.LEVEL_PRO);

        QuestionVO detail = fullDetail();
        QuestionVO result = gate.apply(detail, USER_ID);

        assertSame(detail, result);
        verify(quotaService, never()).ensureAvailable(any(), any());
    }

    @Test
    void freeUserWithinQuotaUnlocksAndConsumes() {
        when(quotaService.isEnabled()).thenReturn(true);
        when(membershipService.resolveLevel(USER_ID)).thenReturn(MembershipQuotaPolicy.LEVEL_FREE);

        QuestionVO result = gate.apply(fullDetail(), USER_ID);

        assertFalse(result.premiumLocked());
        verify(quotaService).ensureAvailable(USER_ID, Resource.ANSWER_DETAIL);
        verify(quotaService).consume(USER_ID, Resource.ANSWER_DETAIL);
    }

    @Test
    void freeUserExhaustedQuotaGetsLockedDetail() {
        when(quotaService.isEnabled()).thenReturn(true);
        when(membershipService.resolveLevel(USER_ID)).thenReturn(MembershipQuotaPolicy.LEVEL_FREE);
        doThrow(new BusinessException(BillingErrorCodes.QUOTA_EXHAUSTED, "今日免费额度已用完"))
                .when(quotaService).ensureAvailable(eq(USER_ID), eq(Resource.ANSWER_DETAIL));

        QuestionVO result = gate.apply(fullDetail(), USER_ID);

        assertTrue(result.premiumLocked());
        assertNull(result.principle());
        verify(quotaService, never()).consume(any(), any());
    }
}
