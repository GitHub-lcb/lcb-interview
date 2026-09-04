package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.membership.MembershipPlanVO;
import com.lcbinterview.dto.membership.MembershipStatusVO;
import com.lcbinterview.dto.membership.QuotaUsageVO;
import com.lcbinterview.model.UserMembership;
import com.lcbinterview.service.CreditService;
import com.lcbinterview.service.MembershipQuotaPolicy;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import com.lcbinterview.service.MembershipQuotaPolicy.Rule;
import com.lcbinterview.service.MembershipService;
import com.lcbinterview.service.QuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 会员中心接口，提供套餐列表和当前用户会员状态查询。
 */
@Slf4j
@Tag(name = "会员中心")
@RestController
@RequestMapping("/api/membership")
@RequiredArgsConstructor
public class MembershipController {

    private final MembershipService membershipService;
    private final CreditService creditService;
    private final QuotaService quotaService;

    /**
     * 查询上架中的订阅套餐与积分包，公开接口供未登录用户浏览定价页。
     *
     * @return 套餐列表
     */
    @Operation(summary = "查询订阅套餐与积分包列表")
    @GetMapping("/plans")
    public ResponseEntity<ApiResponse<List<MembershipPlanVO>>> listPlans() {
        List<MembershipPlanVO> plans = membershipService.listActivePlans().stream()
                .map(MembershipPlanVO::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(plans));
    }

    /**
     * 查询当前用户会员状态：档位、到期时间、积分余额和今日各资源配额用量。
     *
     * @return 会员状态
     */
    @Operation(summary = "查询当前用户会员状态")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<MembershipStatusVO>> status() {
        Long userId = AuthUserContext.currentUserId();
        String level = membershipService.resolveLevel(userId);
        UserMembership membership = membershipService.findActiveMembership(userId);
        List<QuotaUsageVO> quotas = buildQuotaUsages(userId, level);
        MembershipStatusVO status = new MembershipStatusVO(
                level,
                membership == null ? null : membership.getExpireTime(),
                membership == null ? null : membership.getPlanCode(),
                creditService.balance(userId),
                quotaService.isEnabled(),
                quotas);
        return ResponseEntity.ok(ApiResponse.success(status));
    }

    private List<QuotaUsageVO> buildQuotaUsages(Long userId, String level) {
        // PREMIUM_EXPORT 是准入型权益没有每日计数，不纳入用量展示
        return List.of(Resource.AI_EVALUATE, Resource.AI_FOLLOW_UP, Resource.ANSWER_DETAIL, Resource.EXPORT).stream()
                .map(resource -> {
                    Rule rule = MembershipQuotaPolicy.rule(resource, level);
                    int used = quotaService.isEnabled() && !rule.unlimited()
                            ? quotaService.usageOfDay(userId, resource)
                            : 0;
                    return new QuotaUsageVO(resource.name(), rule.dailyLimit(), used, rule.unlimited());
                })
                .toList();
    }
}
