package com.lcbinterview.service;

import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.UserQuotaLogMapper;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import com.lcbinterview.service.MembershipQuotaPolicy.Rule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 每日配额闸门服务。先扣当日免费配额，超限后按策略扣 AI 积分，积分也不足时抛出升级引导错误。
 * 计数优先使用 Redis INCR 保证高性能，Redis 不可用时降级到 user_quota_log 表计数。
 */
@Slf4j
@Service
public class QuotaService {

    private static final String QUOTA_KEY_PREFIX = "lcb:quota:";
    private static final DateTimeFormatter DATE_KEY = DateTimeFormatter.ofPattern("yyyyMMdd");
    /** Redis 键 TTL 取 48 小时，跨天后自动清理，又不会误删当日键 */
    private static final Duration KEY_TTL = Duration.ofHours(48);

    private final MembershipService membershipService;
    private final CreditService creditService;
    private final UserQuotaLogMapper quotaLogMapper;
    private final StringRedisTemplate redisTemplate;
    private final Clock clock;
    private final boolean enabled;

    /**
     * 创建配额服务，使用系统时钟。
     *
     * @param membershipService 会员服务，用于判定档位
     * @param creditService     积分服务，用于超限抵扣
     * @param quotaLogMapper    配额流水 Mapper，Redis 降级与对账依据
     * @param redisTemplate     Redis 计数器
     * @param enabled           配额墙总开关，关闭时所有用户视同 PRO 全量放开
     */
    @Autowired
    public QuotaService(MembershipService membershipService,
                        CreditService creditService,
                        UserQuotaLogMapper quotaLogMapper,
                        StringRedisTemplate redisTemplate,
                        @Value("${app.membership.enabled:false}") boolean enabled) {
        this(membershipService, creditService, quotaLogMapper, redisTemplate, Clock.systemDefaultZone(), enabled);
    }

    QuotaService(MembershipService membershipService,
                 CreditService creditService,
                 UserQuotaLogMapper quotaLogMapper,
                 StringRedisTemplate redisTemplate,
                 Clock clock,
                 boolean enabled) {
        this.membershipService = membershipService;
        this.creditService = creditService;
        this.quotaLogMapper = quotaLogMapper;
        this.redisTemplate = redisTemplate;
        this.clock = clock;
        this.enabled = enabled;
    }

    /**
     * 配额墙总开关是否开启。
     *
     * @return true 表示执行配额管控
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * 预检资源是否可用，不产生消耗。用于先检查后执行的场景（如 AI 评分前先确认额度）。
     *
     * @param userId   用户 ID
     * @param resource 配额资源
     * @throws BusinessException 40302 仅会员可用；40301 免费额度耗尽且无积分可抵扣
     */
    public void ensureAvailable(Long userId, Resource resource) {
        if (!enabled) {
            return;
        }
        Rule rule = ruleOf(userId, resource);
        if (rule.proOnly()) {
            throw new BusinessException(BillingErrorCodes.MEMBER_REQUIRED, "该功能为 PRO 会员专属");
        }
        if (rule.unlimited()) {
            return;
        }
        int used = usageOfDay(userId, resource);
        if (used < rule.dailyLimit()) {
            return;
        }
        // 配额已耗尽：支持积分抵扣且余额足够时放行，consume 阶段会实际扣积分
        if (rule.overflowCreditCost() > 0 && creditService.balance(userId) >= rule.overflowCreditCost()) {
            return;
        }
        throw new BusinessException(BillingErrorCodes.QUOTA_EXHAUSTED, "今日免费额度已用完");
    }

    /**
     * 消耗一次资源配额。在配额内时递增当日计数；超出配额时尝试扣积分，失败则抛错。
     * 调用方应先执行 {@link #ensureAvailable(Long, Resource)} 预检。
     *
     * @param userId   用户 ID
     * @param resource 配额资源
     * @throws BusinessException 40302 仅会员可用；40301 免费额度耗尽且积分不足
     */
    public void consume(Long userId, Resource resource) {
        if (!enabled) {
            return;
        }
        Rule rule = ruleOf(userId, resource);
        if (rule.proOnly()) {
            throw new BusinessException(BillingErrorCodes.MEMBER_REQUIRED, "该功能为 PRO 会员专属");
        }
        if (rule.unlimited()) {
            return;
        }
        CounterStep step = incrementCounter(userId, resource);
        if (step.count() <= rule.dailyLimit()) {
            // DB 降级路径在自增时已落库，避免重复写入流水导致计数翻倍
            if (!step.dbFallback()) {
                recordUsage(userId, resource);
            }
            return;
        }
        // 并发下计数器可能刚好越过上限，先回退 Redis 计数再走积分抵扣，避免配额计数虚高；
        // DB 降级路径无法回退单次自增，接受计数包含本次消耗的口径偏差
        if (!step.dbFallback()) {
            decrementCounter(userId, resource);
        }
        if (rule.overflowCreditCost() <= 0) {
            throw new BusinessException(BillingErrorCodes.QUOTA_EXHAUSTED, "今日免费额度已用完，升级 PRO 解锁更多额度");
        }
        try {
            creditService.consume(userId, rule.overflowCreditCost(), resource.name(), null, "当日配额超限积分抵扣");
        } catch (BusinessException e) {
            // 积分不足统一转述为额度耗尽，前端按 40301 弹升级/充值引导
            throw new BusinessException(BillingErrorCodes.QUOTA_EXHAUSTED, "今日免费额度已用完且 AI 积分不足，请升级或充值积分");
        }
    }

    /**
     * 查询当日已消耗次数。
     *
     * @param userId   用户 ID
     * @param resource 配额资源
     * @return 当日已消耗次数
     */
    public int usageOfDay(Long userId, Resource resource) {
        try {
            String value = redisTemplate.opsForValue().get(counterKey(userId, resource));
            if (value != null) {
                return Integer.parseInt(value);
            }
            return 0;
        } catch (RuntimeException e) {
            log.warn("Redis 配额计数读取失败，降级数据库流水: {}", e.getMessage());
            return quotaLogMapper.selectUsage(userId, resource.name(), today());
        }
    }

    /**
     * 查询当日剩余免费次数，不限量返回 -1。
     *
     * @param userId   用户 ID
     * @param resource 配额资源
     * @return 剩余次数，-1 表示不限量
     */
    public int remainingOfDay(Long userId, Resource resource) {
        if (!enabled) {
            return MembershipQuotaPolicy.UNLIMITED;
        }
        Rule rule = ruleOf(userId, resource);
        if (rule.unlimited()) {
            return MembershipQuotaPolicy.UNLIMITED;
        }
        return Math.max(0, rule.dailyLimit() - usageOfDay(userId, resource));
    }

    private Rule ruleOf(Long userId, Resource resource) {
        return MembershipQuotaPolicy.rule(resource, membershipService.resolveLevel(userId));
    }

    private CounterStep incrementCounter(Long userId, Resource resource) {
        String key = counterKey(userId, resource);
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            long value = count == null ? 1L : count;
            if (value == 1L) {
                // 首次写入设置 TTL，保证跨天后旧键自动清理
                redisTemplate.expire(key, KEY_TTL);
            }
            return new CounterStep(value, false);
        } catch (RuntimeException e) {
            log.warn("Redis 配额计数不可用，降级数据库流水: {}", e.getMessage());
            quotaLogMapper.incrementUsage(userId, resource.name(), today());
            return new CounterStep(quotaLogMapper.selectUsage(userId, resource.name(), today()), true);
        }
    }

    /**
     * 计数器自增结果。
     *
     * @param count      自增后的当日累计次数
     * @param dbFallback 是否走了数据库降级路径，降级时自增已同步落库
     */
    private record CounterStep(long count, boolean dbFallback) {
    }

    private void decrementCounter(Long userId, Resource resource) {
        try {
            redisTemplate.opsForValue().decrement(counterKey(userId, resource));
        } catch (RuntimeException e) {
            // 数据库降级路径的计数是实际消耗汇总，不支持回退，超限判断依赖 selectUsage 重新求和
            log.warn("Redis 配额计数回退失败: {}", e.getMessage());
        }
    }

    private void recordUsage(Long userId, Resource resource) {
        try {
            quotaLogMapper.incrementUsage(userId, resource.name(), today());
        } catch (RuntimeException e) {
            // 流水仅用于降级与对账，写入失败不阻断主流程
            log.warn("配额流水写入失败: userId={}, resource={}, {}", userId, resource, e.getMessage());
        }
    }

    private String counterKey(Long userId, Resource resource) {
        return QUOTA_KEY_PREFIX + userId + ":" + resource.name() + ":" + today().format(DATE_KEY);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
