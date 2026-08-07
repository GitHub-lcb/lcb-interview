package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.QuestionKnowledgePoint;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 题目-考点关联 Mapper。
 */
public interface QuestionKnowledgePointMapper extends BaseMapper<QuestionKnowledgePoint> {

    /**
     * 按考点聚合关联题目数，供权重计算使用。
     *
     * @return 考点级聚合行
     */
    @Select("""
            SELECT qkp.knowledge_point_id AS kp_id, COUNT(DISTINCT q.id) AS total
            FROM question_knowledge_point qkp
            INNER JOIN question q ON q.id = qkp.question_id
            INNER JOIN knowledge_point kp ON kp.id = qkp.knowledge_point_id
            WHERE q.is_deleted = 0
              AND q.status = 'PUBLISHED'
              AND kp.is_deleted = 0
            GROUP BY qkp.knowledge_point_id
            """)
    List<IdCount> selectRelationCounts();

    /**
     * 幂等写入题目-考点关联，并发重复写入时安全忽略。
     *
     * @param questionId      题目 ID
     * @param knowledgePointId 考点 ID
     * @return 新增行数
     */
    @Insert("""
            INSERT IGNORE INTO question_knowledge_point (question_id, knowledge_point_id, source)
            VALUES (#{questionId}, #{knowledgePointId}, 'AI')
            """)
    int insertIgnore(@Param("questionId") Long questionId,
                     @Param("knowledgePointId") Long knowledgePointId);

    /**
     * 删除指定题目由 AI 生成的旧关联，人工关联保持不变。
     *
     * @param questionIds 题目 ID 列表
     * @return 删除行数
     */
    @Delete("""
            <script>
            DELETE FROM question_knowledge_point
            WHERE source = 'AI' AND question_id IN
            <foreach collection="questionIds" item="questionId" open="(" separator="," close=")">
                #{questionId}
            </foreach>
            </script>
            """)
    int deleteAiByQuestionIds(@Param("questionIds") List<Long> questionIds);

    /**
     * 考点聚合行。
     *
     * @param kpId  考点 ID
     * @param total 关联数
     */
    record IdCount(Long kpId, Long total) {
    }
}
