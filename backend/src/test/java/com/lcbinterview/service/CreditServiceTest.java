package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.CreditTransactionMapper;
import com.lcbinterview.mapper.UserCreditMapper;
import com.lcbinterview.model.CreditTransaction;
import com.lcbinterview.model.UserCredit;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI 积分服务测试，覆盖余额保护、流水连续性和首次发放建行。
 */
class CreditServiceTest {

    private UserCreditMapper userCreditMapper;
    private CreditTransactionMapper transactionMapper;
    private CreditService creditService;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), UserCredit.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), CreditTransaction.class);
        userCreditMapper = mock(UserCreditMapper.class);
        transactionMapper = mock(CreditTransactionMapper.class);
        creditService = new CreditService(userCreditMapper, transactionMapper);
    }

    @Test
    void balanceDefaultsToZeroWithoutRow() {
        when(userCreditMapper.selectOne(any())).thenReturn(null);

        assertEquals(0, creditService.balance(1L));
    }

    @Test
    void consumeFailsWhenBalanceInsufficient() {
        when(userCreditMapper.consumeBalance(1L, 5)).thenReturn(0);

        BusinessException e = assertThrows(BusinessException.class,
                () -> creditService.consume(1L, 5, "AI_EVALUATE", null, "测试"));

        assertEquals(BillingErrorCodes.CREDIT_INSUFFICIENT, e.getCode());
        // 扣减失败不写流水，保证流水与余额一致
        verify(transactionMapper, never()).insert(any());
    }

    @Test
    void consumeWritesNegativeTransactionWithBalanceAfter() {
        when(userCreditMapper.consumeBalance(1L, 1)).thenReturn(1);
        UserCredit after = new UserCredit();
        after.setUserId(1L);
        after.setBalance(9);
        when(userCreditMapper.selectOne(any())).thenReturn(after);

        creditService.consume(1L, 1, "AI_EVALUATE", "ref-1", "超限抵扣");

        ArgumentCaptor<CreditTransaction> captor = ArgumentCaptor.forClass(CreditTransaction.class);
        verify(transactionMapper).insert(captor.capture());
        CreditTransaction transaction = captor.getValue();
        assertEquals(CreditTransaction.TYPE_CONSUME, transaction.getType());
        assertEquals(-1, transaction.getAmount());
        assertEquals(9, transaction.getBalanceAfter());
        assertEquals("AI_EVALUATE", transaction.getResource());
    }

    @Test
    void grantInitializesRowAndWritesTransaction() {
        when(userCreditMapper.selectOne(any())).thenReturn(null);
        when(userCreditMapper.addBalance(eq(1L), eq(100))).thenReturn(1);
        UserCredit after = new UserCredit();
        after.setUserId(1L);
        after.setBalance(100);
        // 首次查询返回 null 建行，扣减后再查返回最新余额
        when(userCreditMapper.selectOne(any())).thenReturn(null, after);

        creditService.grant(1L, 100, CreditTransaction.TYPE_PURCHASE, "order-1", "购买积分包");

        verify(userCreditMapper).insert(any(UserCredit.class));
        verify(userCreditMapper).addBalance(1L, 100);
        ArgumentCaptor<CreditTransaction> captor = ArgumentCaptor.forClass(CreditTransaction.class);
        verify(transactionMapper).insert(captor.capture());
        assertEquals(100, captor.getValue().getAmount());
        assertEquals(100, captor.getValue().getBalanceAfter());
    }

    @Test
    void grantRejectsNonPositiveAmount() {
        assertThrows(BusinessException.class, () -> creditService.grant(1L, 0, "GRANT", null, ""));
        verify(userCreditMapper, never()).addBalance(any(), eq(0));
    }
}
