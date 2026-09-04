package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.MembershipPlanMapper;
import com.lcbinterview.mapper.UserOrderMapper;
import com.lcbinterview.model.CreditTransaction;
import com.lcbinterview.model.MembershipPlan;
import com.lcbinterview.model.UserOrder;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 订单服务测试，覆盖下单定价、支付发货、重复回调幂等和越权防护。
 */
class OrderServiceTest {

    private static final Long USER_ID = 1L;
    private static final String ORDER_NO = "LCB20260820120000123456";

    private UserOrderMapper orderMapper;
    private MembershipPlanMapper planMapper;
    private MembershipService membershipService;
    private CreditService creditService;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), UserOrder.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), MembershipPlan.class);
        orderMapper = mock(UserOrderMapper.class);
        planMapper = mock(MembershipPlanMapper.class);
        membershipService = mock(MembershipService.class);
        creditService = mock(CreditService.class);
        orderService = new OrderService(orderMapper, planMapper, membershipService, creditService);
    }

    private MembershipPlan proMonthlyPlan() {
        MembershipPlan plan = new MembershipPlan();
        plan.setId(1L);
        plan.setCode("PRO_MONTHLY");
        plan.setType(UserOrder.TYPE_SUBSCRIPTION);
        plan.setPriceCents(2900);
        plan.setDurationDays(30);
        plan.setMonthlyCreditGrant(100);
        plan.setStatus("ACTIVE");
        return plan;
    }

    private MembershipPlan creditPack() {
        MembershipPlan plan = new MembershipPlan();
        plan.setId(3L);
        plan.setCode("CREDIT_PACK_100");
        plan.setType(UserOrder.TYPE_CREDIT_PACK);
        plan.setPriceCents(990);
        plan.setDurationDays(0);
        plan.setCreditAmount(100);
        plan.setStatus("ACTIVE");
        return plan;
    }

    private UserOrder pendingOrder(String type, String planCode, Integer creditAmount) {
        UserOrder order = new UserOrder();
        order.setId(100L);
        order.setOrderNo(ORDER_NO);
        order.setUserId(USER_ID);
        order.setType(type);
        order.setPlanCode(planCode);
        order.setCreditAmount(creditAmount == null ? 0 : creditAmount);
        order.setStatus(UserOrder.STATUS_PENDING);
        return order;
    }

    @Test
    void createOrderCopiesPriceAndTypeFromActivePlan() {
        when(planMapper.selectOne(any())).thenReturn(proMonthlyPlan());

        UserOrder order = orderService.createOrder(USER_ID, "PRO_MONTHLY");

        assertEquals(2900, order.getAmountCents());
        assertEquals(UserOrder.TYPE_SUBSCRIPTION, order.getType());
        assertEquals(UserOrder.STATUS_PENDING, order.getStatus());
        assertTrue(order.getOrderNo().startsWith("LCB"));
        verify(orderMapper).insert(order);
    }

    @Test
    void createOrderRejectsOfflinePlan() {
        MembershipPlan offline = proMonthlyPlan();
        offline.setStatus("OFFLINE");
        when(planMapper.selectOne(any())).thenReturn(offline);

        BusinessException e = assertThrows(BusinessException.class,
                () -> orderService.createOrder(USER_ID, "PRO_MONTHLY"));

        assertEquals(404, e.getCode());
        verify(orderMapper, never()).insert(any());
    }

    @Test
    void payCallbackDeliversSubscriptionAndGrantCredits() {
        UserOrder order = pendingOrder(UserOrder.TYPE_SUBSCRIPTION, "PRO_MONTHLY", null);
        when(orderMapper.selectOne(any())).thenReturn(order);
        when(planMapper.selectOne(any())).thenReturn(proMonthlyPlan());
        when(orderMapper.markPaid(eq(USER_ID), eq(ORDER_NO), anyString(), any(LocalDateTime.class))).thenReturn(1);

        orderService.mockPayCallback(USER_ID, ORDER_NO);

        verify(membershipService).activateOrExtend(USER_ID, "PRO_MONTHLY", 30);
        verify(creditService).grant(eq(USER_ID), eq(100), eq(CreditTransaction.TYPE_GRANT), eq(ORDER_NO), anyString());
    }

    @Test
    void payCallbackDeliversCreditPackByPurchaseType() {
        UserOrder order = pendingOrder(UserOrder.TYPE_CREDIT_PACK, "CREDIT_PACK_100", 100);
        when(orderMapper.selectOne(any())).thenReturn(order);
        when(planMapper.selectOne(any())).thenReturn(creditPack());
        when(orderMapper.markPaid(eq(USER_ID), eq(ORDER_NO), anyString(), any(LocalDateTime.class))).thenReturn(1);

        orderService.mockPayCallback(USER_ID, ORDER_NO);

        verify(membershipService, never()).activateOrExtend(any(), any(), eq(0));
        verify(creditService).grant(eq(USER_ID), eq(100), eq(CreditTransaction.TYPE_PURCHASE), eq(ORDER_NO), anyString());
    }

    @Test
    void duplicateCallbackOnPaidOrderIsIdempotent() {
        UserOrder paid = pendingOrder(UserOrder.TYPE_SUBSCRIPTION, "PRO_MONTHLY", null);
        paid.setStatus(UserOrder.STATUS_PAID);
        paid.setOutTradeNo("MOCK-" + ORDER_NO);
        when(orderMapper.selectOne(any())).thenReturn(paid);

        UserOrder result = orderService.mockPayCallback(USER_ID, ORDER_NO);

        assertEquals(UserOrder.STATUS_PAID, result.getStatus());
        // 重复回调不再改单、不再发货
        verify(orderMapper, never()).markPaid(any(), any(), any(), any());
        verify(membershipService, never()).activateOrExtend(any(), any(), eq(30));
        verify(creditService, never()).grant(any(), eq(100), any(), any(), any());
    }

    @Test
    void concurrentCallbackLoserSkipsDelivery() {
        UserOrder order = pendingOrder(UserOrder.TYPE_SUBSCRIPTION, "PRO_MONTHLY", null);
        when(orderMapper.selectOne(any())).thenReturn(order);
        // 并发下条件更新失败，说明已被其他回调支付
        when(orderMapper.markPaid(eq(USER_ID), eq(ORDER_NO), anyString(), any(LocalDateTime.class))).thenReturn(0);

        orderService.mockPayCallback(USER_ID, ORDER_NO);

        verify(membershipService, never()).activateOrExtend(any(), any(), eq(30));
        verify(creditService, never()).grant(any(), eq(100), any(), any(), any());
    }

    @Test
    void payCallbackRejectsOtherUsersOrder() {
        UserOrder order = pendingOrder(UserOrder.TYPE_SUBSCRIPTION, "PRO_MONTHLY", null);
        order.setUserId(999L);
        when(orderMapper.selectOne(any())).thenReturn(order);

        BusinessException e = assertThrows(BusinessException.class,
                () -> orderService.mockPayCallback(USER_ID, ORDER_NO));

        assertEquals(404, e.getCode());
        verify(orderMapper, never()).markPaid(any(), any(), any(), any());
    }
}
