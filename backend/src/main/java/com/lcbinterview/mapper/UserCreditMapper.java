package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.UserCredit;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

/**
 * 用户 AI 积分余额 Mapper，提供防并发的条件更新扣减和累加。
 */
public interface UserCreditMapper extends BaseMapper<UserCredit> {

    /**
     * 条件扣减积分：仅当余额足够时更新，避免并发扣减出现负余额。
     *
     * @param userId 用户 ID
     * @param cost   扣减数量
     * @return 影响行数，0 表示余额不足
     */
    @Update("""
            UPDATE user_credit
            SET balance = balance - #{cost},
                total_consumed = total_consumed + #{cost},
                update_time = NOW()
            WHERE user_id = #{userId}
              AND balance >= #{cost}
            """)
    int consumeBalance(@Param("userId") Long userId, @Param("cost") int cost);

    /**
     * 累加积分余额。
     *
     * @param userId 用户 ID
     * @param amount 累加数量
     * @return 影响行数
     */
    @Update("""
            UPDATE user_credit
            SET balance = balance + #{amount},
                total_granted = total_granted + #{amount},
                update_time = NOW()
            WHERE user_id = #{userId}
            """)
    int addBalance(@Param("userId") Long userId, @Param("amount") int amount);
}
