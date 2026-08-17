package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.SsqDraw;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 双色球开奖 Mapper。
 */
public interface SsqDrawMapper extends BaseMapper<SsqDraw> {

    /**
     * 查询指定期数以内的最近开奖记录，供特征计算使用。
     *
     * @param issueNo 截止期号（含）
     * @param limit   返回条数
     * @return 开奖记录
     */
    @Select("""
            SELECT id, issue_no, draw_date, red_numbers, blue_number,
                   source_url, source_name, create_time, update_time
            FROM lottery_ssq_draw
            WHERE issue_no <= #{issueNo}
            ORDER BY issue_no DESC
            LIMIT #{limit}
            """)
    List<SsqDraw> selectRecentUpTo(String issueNo, int limit);
}
