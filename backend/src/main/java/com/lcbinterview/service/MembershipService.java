package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.MembershipPlanMapper;
import com.lcbinterview.mapper.UserMembershipMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.MembershipPlan;
import com.lcbinterview.model.UserMembership;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 会员服务，负责会员等级判定、开通续期和到期回收。
 * 权益判定一律以 user_membership 有效期为准，app_user.membership_level 仅做展示冗余列。
 */
@Slf4j
@Service
public class MembershipService {

    private final UserMembershipMapper membershipMapper;
    private final MembershipPlanMapper planMapper;
    private final AppUserMapper appUserMapper;
    private final Clock clock;

    /**
     * 创建会员服务，使用系统时钟。
     *
     * @param membershipMapper 会员订阅 Mapper
     * @param planMapper       订阅计划 Mapper
     * @param appUserMapper    用户 Mapper，用于同步冗余等级列
     */
    @Autowired
    public MembershipService(UserMembershipMapper membershipMapper,
                             MembershipPlanMapper planMapper,
                             AppUserMapper appUserMapper) {
        this(membershipMapper, planMapper, appUserMapper, Clock.systemDefaultZone());
    }

    MembershipService(UserMembershipMapper membershipMapper,
                      MembershipPlanMapper planMapper,
                      AppUserMapper appUserMapper,
                      Clock clock) {
        this.membershipMapper = membershipMapper;
        this.planMapper = planMapper;
        this.appUserMapper = appUserMapper;
        this.clock = clock;
    }

    /**
     * 查询全部上架中的订阅计划与积分包。
     *
     * @return 计划列表
     */
    @Transactional(readOnly = true)
    public List<MembershipPlan> listActivePlans() {
        return planMapper.selectList(Wrappers.<MembershipPlan>lambdaQuery()
                .eq(MembershipPlan::getStatus, "ACTIVE")
                .orderByAsc(MembershipPlan::getId));
    }

    /**
     * 解析用户当前会员等级。
     *
     * @param userId 用户 ID，可为空（游客按 FREE 处理）
     * @return FREE / PRO
     */
    @Transactional(readOnly = true)
    public String resolveLevel(Long userId) {
        return findActiveMembership(userId) == null
                ? MembershipQuotaPolicy.LEVEL_FREE
                : MembershipQuotaPolicy.LEVEL_PRO;
    }

    /**
     * 查询用户当前生效的会员订阅，已过期记录会被顺带置为 EXPIRED。
     *
     * @param userId 用户 ID，可为空
     * @return 生效中的会员订阅，无则为 null
     */
    @Transactional
    public UserMembership findActiveMembership(Long userId) {
        if (userId == null) {
            return null;
        }
        UserMembership membership = membershipMapper.selectOne(Wrappers.<UserMembership>lambdaQuery()
                .eq(UserMembership::getUserId, userId)
                .eq(UserMembership::getStatus, UserMembership.STATUS_ACTIVE)
                .orderByDesc(UserMembership::getExpireTime)
                .last("LIMIT 1"));
        if (membership == null) {
            return null;
        }
        if (!membership.getExpireTime().isAfter(LocalDateTime.now(clock))) {
            // 惰性过期：读取时发现到期立即落库，避免依赖定时任务的执行时点
            membership.setStatus(UserMembership.STATUS_EXPIRED);
            membershipMapper.updateById(membership);
            syncLevelColumn(userId, MembershipQuotaPolicy.LEVEL_FREE);
            return null;
        }
        return membership;
    }

    /**
     * 开通或续期会员。已生效订阅在到期时间上叠加时长，避免提前续费浪费剩余天数。
     *
     * @param userId       用户 ID
     * @param planCode     订阅计划编码
     * @param durationDays 订阅时长天数
     * @return 生效中的会员订阅
     */
    @Transactional
    public UserMembership activateOrExtend(Long userId, String planCode, int durationDays) {
        if (durationDays <= 0) {
            throw new BusinessException(400, "订阅时长必须大于 0");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        UserMembership active = findActiveMembership(userId);
        if (active != null) {
            active.setPlanCode(planCode);
            active.setExpireTime(active.getExpireTime().plusDays(durationDays));
            membershipMapper.updateById(active);
            syncLevelColumn(userId, MembershipQuotaPolicy.LEVEL_PRO);
            log.info("会员续期成功: userId={}, plan={}, 新到期时间={}", userId, planCode, active.getExpireTime());
            return active;
        }
        UserMembership membership = new UserMembership();
        membership.setUserId(userId);
        membership.setPlanCode(planCode);
        membership.setStartTime(now);
        membership.setExpireTime(now.plusDays(durationDays));
        membership.setStatus(UserMembership.STATUS_ACTIVE);
        membership.setAutoRenew(0);
        membershipMapper.insert(membership);
        syncLevelColumn(userId, MembershipQuotaPolicy.LEVEL_PRO);
        log.info("会员开通成功: userId={}, plan={}, 到期时间={}", userId, planCode, membership.getExpireTime());
        return membership;
    }

    /**
     * 批量回收已过期会员，并同步冗余等级列。每小时执行一次，
     * 与惰性过期互为兜底，保证冗余列不会长期停留在 PRO。
     */
    @Scheduled(fixedDelay = 3600_000L)
    @Transactional
    public void expireOverdueMemberships() {
        List<UserMembership> overdue = membershipMapper.selectList(Wrappers.<UserMembership>lambdaQuery()
                .eq(UserMembership::getStatus, UserMembership.STATUS_ACTIVE)
                .le(UserMembership::getExpireTime, LocalDateTime.now(clock))
                .last("LIMIT 500"));
        if (overdue.isEmpty()) {
            return;
        }
        for (UserMembership membership : overdue) {
            membership.setStatus(UserMembership.STATUS_EXPIRED);
            membershipMapper.updateById(membership);
            syncLevelColumn(membership.getUserId(), MembershipQuotaPolicy.LEVEL_FREE);
        }
        log.info("过期会员回收完成，共 {} 条", overdue.size());
    }

    private void syncLevelColumn(Long userId, String level) {
        AppUser update = new AppUser();
        update.setId(userId);
        update.setMembershipLevel(level);
        appUserMapper.updateById(update);
    }
}
