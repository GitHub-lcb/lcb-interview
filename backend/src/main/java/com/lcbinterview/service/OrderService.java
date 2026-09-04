package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.MembershipPlanMapper;
import com.lcbinterview.mapper.UserOrderMapper;
import com.lcbinterview.model.CreditTransaction;
import com.lcbinterview.model.MembershipPlan;
import com.lcbinterview.model.UserOrder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 订单服务，负责订阅/积分包下单、模拟支付回调和订单查询。
 * 真实支付渠道接入前，用模拟回调打通「下单 -> 支付 -> 发货」全链路；
 * 回调按订单状态条件更新保证幂等，重复回调直接返回已支付结果。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final DateTimeFormatter ORDER_NO_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserOrderMapper orderMapper;
    private final MembershipPlanMapper planMapper;
    private final MembershipService membershipService;
    private final CreditService creditService;
    private final Clock clock = Clock.systemDefaultZone();

    /**
     * 创建待支付订单。
     *
     * @param userId   用户 ID
     * @param planCode 计划编码，必须是上架中的订阅或积分包
     * @return 订单实体
     */
    @Transactional
    public UserOrder createOrder(Long userId, String planCode) {
        MembershipPlan plan = loadActivePlan(planCode);
        UserOrder order = new UserOrder();
        order.setOrderNo(generateOrderNo());
        order.setUserId(userId);
        order.setType(plan.getType());
        order.setPlanCode(plan.getCode());
        order.setCreditAmount(plan.getCreditAmount() == null ? 0 : plan.getCreditAmount());
        order.setAmountCents(plan.getPriceCents());
        order.setStatus(UserOrder.STATUS_PENDING);
        orderMapper.insert(order);
        log.info("订单创建: orderNo={}, userId={}, plan={}, amountCents={}",
                order.getOrderNo(), userId, plan.getCode(), order.getAmountCents());
        return order;
    }

    /**
     * 模拟支付成功回调。幂等处理：已支付订单重复回调直接返回当前订单，不重复发货。
     *
     * @param userId  用户 ID，防止操作他人订单
     * @param orderNo 订单号
     * @return 支付后的订单实体
     */
    @Transactional
    public UserOrder mockPayCallback(Long userId, String orderNo) {
        UserOrder order = loadOwnedOrder(userId, orderNo);
        if (UserOrder.STATUS_PAID.equals(order.getStatus())) {
            log.info("重复支付回调，幂等返回: orderNo={}", orderNo);
            return order;
        }
        if (!UserOrder.STATUS_PENDING.equals(order.getStatus())) {
            throw new BusinessException(400, "订单当前状态不可支付");
        }
        LocalDateTime paidTime = LocalDateTime.now(clock);
        // 条件更新保证并发回调只有一个成功，失败方按已处理返回
        int affected = orderMapper.markPaid(userId, orderNo, "MOCK-" + orderNo, paidTime);
        if (affected == 0) {
            log.info("订单已被并发回调处理: orderNo={}", orderNo);
            return loadOwnedOrder(userId, orderNo);
        }
        deliver(userId, loadOwnedOrder(userId, orderNo));
        return loadOwnedOrder(userId, orderNo);
    }

    /**
     * 分页查询用户订单，按创建时间倒序。
     *
     * @param userId 用户 ID
     * @param page   页码，从 0 开始
     * @param size   每页条数
     * @return 订单分页结果
     */
    @Transactional(readOnly = true)
    public IPage<UserOrder> pageOrders(Long userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        return orderMapper.selectPage(
                new Page<>(safePage + 1L, safeSize),
                Wrappers.<UserOrder>lambdaQuery()
                        .eq(UserOrder::getUserId, userId)
                        .orderByDesc(UserOrder::getId));
    }

    /**
     * 发货：订阅订单开通/续期会员并赠送积分，积分包订单直接发放积分。
     */
    private void deliver(Long userId, UserOrder order) {
        MembershipPlan plan = loadActivePlan(order.getPlanCode());
        if (UserOrder.TYPE_SUBSCRIPTION.equals(order.getType())) {
            membershipService.activateOrExtend(userId, plan.getCode(), plan.getDurationDays());
            int grant = plan.getMonthlyCreditGrant() == null ? 0 : plan.getMonthlyCreditGrant();
            if (grant > 0) {
                creditService.grant(userId, grant, CreditTransaction.TYPE_GRANT, order.getOrderNo(), "订阅赠送积分");
            }
            log.info("订阅订单发货完成: orderNo={}, userId={}, plan={}", order.getOrderNo(), userId, plan.getCode());
            return;
        }
        creditService.grant(userId, order.getCreditAmount(), CreditTransaction.TYPE_PURCHASE,
                order.getOrderNo(), "购买积分包");
        log.info("积分包订单发货完成: orderNo={}, userId={}, credits={}",
                order.getOrderNo(), userId, order.getCreditAmount());
    }

    private MembershipPlan loadActivePlan(String planCode) {
        MembershipPlan plan = planMapper.selectOne(Wrappers.<MembershipPlan>lambdaQuery()
                .eq(MembershipPlan::getCode, planCode));
        if (plan == null || !"ACTIVE".equals(plan.getStatus())) {
            throw new BusinessException(404, "套餐不存在或已下架");
        }
        return plan;
    }

    private UserOrder loadOwnedOrder(Long userId, String orderNo) {
        UserOrder order = orderMapper.selectOne(Wrappers.<UserOrder>lambdaQuery()
                .eq(UserOrder::getOrderNo, orderNo));
        if (order == null || !order.getUserId().equals(userId)) {
            throw new BusinessException(404, "订单不存在");
        }
        return order;
    }

    private String generateOrderNo() {
        // 时间戳 + 6 位随机数，单机并发下冲突概率极低，唯一键兜底防重
        return "LCB" + LocalDateTime.now(clock).format(ORDER_NO_TIME)
                + String.format("%06d", RANDOM.nextInt(1_000_000));
    }
}
