package com.lcbinterview.service;

import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 题目详情答案会员墙闸门。对 PRO 会员和配额内的 FREE 用户返回完整深度字段，
 * 超出配额或未登录时返回锁定副本，前端据此展示模糊遮罩和解锁引导。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnswerPremiumGate {

    private final MembershipService membershipService;
    private final QuotaService quotaService;

    /**
     * 按会员档位和当日配额决定题目详情深度字段是否解锁。
     *
     * @param detail 完整题目详情 VO
     * @param userId 当前用户 ID，游客为 null
     * @return 解锁或锁定深度字段后的题目 VO
     */
    public QuestionVO apply(QuestionVO detail, Long userId) {
        // 配额墙关闭期间全量放开，不做任何拦截
        if (!quotaService.isEnabled()) {
            return detail;
        }
        if (userId == null) {
            // 游客不消耗配额，直接展示锁定版本引导注册登录
            return detail.withLockedPremium();
        }
        if (MembershipQuotaPolicy.LEVEL_PRO.equals(membershipService.resolveLevel(userId))) {
            return detail;
        }
        try {
            quotaService.ensureAvailable(userId, Resource.ANSWER_DETAIL);
            quotaService.consume(userId, Resource.ANSWER_DETAIL);
            return detail;
        } catch (BusinessException e) {
            log.info("答案深度字段已锁定: userId={}, questionId={}, code={}", userId, detail.id(), e.getCode());
            return detail.withLockedPremium();
        }
    }
}
