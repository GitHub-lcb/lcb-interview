package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.UserOrder;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

/**
 * 会员订阅与积分包订单 Mapper，提供支付回调幂等所需的状态条件更新。
 */
public interface UserOrderMapper extends BaseMapper<UserOrder> {

    /**
     * 将订单从待支付推进为已支付。仅当当前状态为 PENDING 时生效，
     * 重复回调或并发回调只有一个成功，是支付幂等的核心保障。
     *
     * @param userId     用户 ID，防止跨用户操作他人订单
     * @param orderNo    订单号
     * @param outTradeNo 支付渠道交易号
     * @param paidTime   支付完成时间
     * @return 影响行数，0 表示订单已被处理或不存在
     */
    @Update("""
            UPDATE user_order
            SET status = 'PAID',
                out_trade_no = #{outTradeNo},
                paid_time = #{paidTime},
                update_time = NOW()
            WHERE user_id = #{userId}
              AND order_no = #{orderNo}
              AND status = 'PENDING'
              AND is_deleted = 0
            """)
    int markPaid(@Param("userId") Long userId,
                 @Param("orderNo") String orderNo,
                 @Param("outTradeNo") String outTradeNo,
                 @Param("paidTime") LocalDateTime paidTime);
}
