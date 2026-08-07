package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.InterviewFeedback;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 用户面试回填 Mapper。
 */
public interface InterviewFeedbackMapper extends BaseMapper<InterviewFeedback> {

    /**
     * 按考点聚合回填频次，供权重计算使用。
     *
     * @return 考点级聚合行
     */
    @Select("""
            SELECT f.knowledge_point_id AS kp_id, COUNT(*) AS total
            FROM interview_feedback f
            INNER JOIN knowledge_point kp ON kp.id = f.knowledge_point_id
            WHERE f.is_deleted = 0
              AND f.knowledge_point_id IS NOT NULL
              AND kp.is_deleted = 0
            GROUP BY f.knowledge_point_id
            """)
    List<IdCount> selectFeedbackCounts();

    /**
     * 考点聚合行。
     *
     * @param kpId  考点 ID
     * @param total 回填数
     */
    record IdCount(Long kpId, Long total) {
    }
}
