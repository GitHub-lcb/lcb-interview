package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.UserQuotaLog;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;

/**
 * 每日配额消耗流水 Mapper，提供原子自增和当日计数查询。
 */
public interface UserQuotaLogMapper extends BaseMapper<UserQuotaLog> {

    /**
     * 原子自增当日配额消耗计数。依赖唯一键做 upsert，避免先查后写的并发问题。
     *
     * @param userId    用户 ID
     * @param resource  配额资源类型
     * @param quotaDate 配额归属日期
     * @return 影响行数
     */
    @Insert("""
            INSERT INTO user_quota_log (user_id, resource, quota_date, count, create_time, update_time)
            VALUES (#{userId}, #{resource}, #{quotaDate}, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE count = count + 1, update_time = NOW()
            """)
    int incrementUsage(@Param("userId") Long userId,
                       @Param("resource") String resource,
                       @Param("quotaDate") LocalDate quotaDate);

    /**
     * 查询当日已消耗次数，无记录时返回 0。
     *
     * @param userId    用户 ID
     * @param resource  配额资源类型
     * @param quotaDate 配额归属日期
     * @return 当日已消耗次数
     */
    @Select("""
            SELECT COALESCE(SUM(count), 0)
            FROM user_quota_log
            WHERE user_id = #{userId}
              AND resource = #{resource}
              AND quota_date = #{quotaDate}
            """)
    int selectUsage(@Param("userId") Long userId,
                    @Param("resource") String resource,
                    @Param("quotaDate") LocalDate quotaDate);
}
