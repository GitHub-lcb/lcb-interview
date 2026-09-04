package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.CreditTransactionMapper;
import com.lcbinterview.mapper.UserCreditMapper;
import com.lcbinterview.model.CreditTransaction;
import com.lcbinterview.model.UserCredit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 积分服务，负责余额初始化、发放、扣减和流水查询。
 * 扣减使用数据库条件更新，保证并发下不会出现负余额。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CreditService {

    private final UserCreditMapper userCreditMapper;
    private final CreditTransactionMapper transactionMapper;

    /**
     * 查询用户积分余额，未初始化余额行按 0 处理。
     *
     * @param userId 用户 ID
     * @return 当前余额
     */
    @Transactional(readOnly = true)
    public int balance(Long userId) {
        UserCredit credit = findByUserId(userId);
        return credit == null ? 0 : credit.getBalance();
    }

    /**
     * 查询用户积分账户完整信息。
     *
     * @param userId 用户 ID
     * @return 积分账户，不存在时返回零值对象
     */
    @Transactional(readOnly = true)
    public UserCredit account(Long userId) {
        UserCredit credit = findByUserId(userId);
        if (credit != null) {
            return credit;
        }
        UserCredit empty = new UserCredit();
        empty.setUserId(userId);
        empty.setBalance(0);
        empty.setTotalGranted(0L);
        empty.setTotalConsumed(0L);
        return empty;
    }

    /**
     * 发放积分并记录流水。首次发放会自动初始化余额行。
     *
     * @param userId 用户 ID
     * @param amount 发放数量，必须为正数
     * @param type   流水类型：GRANT / PURCHASE / REFUND
     * @param refId  关联订单号或业务 ID，可为空
     * @param remark 备注说明
     */
    @Transactional
    public void grant(Long userId, int amount, String type, String refId, String remark) {
        if (amount <= 0) {
            throw new BusinessException(400, "积分发放数量必须大于 0");
        }
        ensureCreditRow(userId);
        userCreditMapper.addBalance(userId, amount);
        insertTransaction(userId, type, amount, balance(userId), null, refId, remark);
        log.info("积分发放: userId={}, amount={}, type={}, refId={}", userId, amount, type, refId);
    }

    /**
     * 扣减积分并记录流水。余额不足时抛出 40303，由调用方决定如何转述给用户。
     *
     * @param userId   用户 ID
     * @param cost     扣减数量，必须为正数
     * @param resource 消耗资源类型
     * @param refId    关联业务 ID，可为空
     * @param remark   备注说明
     */
    @Transactional
    public void consume(Long userId, int cost, String resource, String refId, String remark) {
        if (cost <= 0) {
            throw new BusinessException(400, "积分扣减数量必须大于 0");
        }
        // 条件更新只扣余额足够的请求，并发扣减时天然串行化，不会出现负余额
        int affected = userCreditMapper.consumeBalance(userId, cost);
        if (affected == 0) {
            log.warn("积分不足，扣减失败: userId={}, cost={}, resource={}", userId, cost, resource);
            throw new BusinessException(BillingErrorCodes.CREDIT_INSUFFICIENT, "AI 积分不足");
        }
        insertTransaction(userId, CreditTransaction.TYPE_CONSUME, -cost, balance(userId), resource, refId, remark);
        log.info("积分扣减: userId={}, cost={}, resource={}", userId, cost, resource);
    }

    /**
     * 分页查询用户积分流水，按时间倒序。
     *
     * @param userId 用户 ID
     * @param page   页码，从 0 开始
     * @param size   每页条数
     * @return 流水分页结果
     */
    @Transactional(readOnly = true)
    public IPage<CreditTransaction> pageTransactions(Long userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        return transactionMapper.selectPage(
                new Page<>(safePage + 1L, safeSize),
                Wrappers.<CreditTransaction>lambdaQuery()
                        .eq(CreditTransaction::getUserId, userId)
                        .orderByDesc(CreditTransaction::getId));
    }

    private UserCredit findByUserId(Long userId) {
        return userCreditMapper.selectOne(Wrappers.<UserCredit>lambdaQuery()
                .eq(UserCredit::getUserId, userId));
    }

    private void ensureCreditRow(Long userId) {
        if (findByUserId(userId) != null) {
            return;
        }
        UserCredit credit = new UserCredit();
        credit.setUserId(userId);
        credit.setBalance(0);
        credit.setTotalGranted(0L);
        credit.setTotalConsumed(0L);
        try {
            userCreditMapper.insert(credit);
        } catch (DuplicateKeyException e) {
            // 并发首次发放时另一个请求已建行，忽略冲突即可
            log.info("积分余额行已由并发请求初始化: userId={}", userId);
        }
    }

    private void insertTransaction(Long userId, String type, int amount, int balanceAfter,
                                   String resource, String refId, String remark) {
        CreditTransaction transaction = new CreditTransaction();
        transaction.setUserId(userId);
        transaction.setType(type);
        transaction.setAmount(amount);
        transaction.setBalanceAfter(balanceAfter);
        transaction.setResource(resource);
        transaction.setRefId(refId);
        transaction.setRemark(remark);
        transactionMapper.insert(transaction);
    }
}
