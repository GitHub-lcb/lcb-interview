package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.KnowledgePoint;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 高频考点 Mapper。
 */
public interface KnowledgePointMapper extends BaseMapper<KnowledgePoint> {

    /**
     * 查询全部未删除考点 ID，避免权重重算加载完整实体。
     *
     * @return 考点 ID 列表
     */
    @Select("""
            SELECT id
            FROM knowledge_point
            WHERE is_deleted = 0
            """)
    List<Long> selectAllIds();

    /**
     * 按分类和规范化名称原子创建或恢复考点，并把最终主键写回实体。
     *
     * @param point 待写入考点
     * @return MySQL 受影响行数，1 表示新增，其他值表示已存在
     */
    @Insert("""
            INSERT INTO knowledge_point (
                category_id, name, slug, parent_id, hot_score, hot_score_source,
                status, description, create_time, update_time, is_deleted
            ) VALUES (
                #{categoryId}, #{name}, #{slug}, #{parentId}, #{hotScore}, #{hotScoreSource},
                #{status}, #{description}, NOW(), NOW(), 0
            )
            ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id),
                is_deleted = 0,
                update_time = NOW()
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int upsertPoint(KnowledgePoint point);

    /**
     * 按业务唯一键查询考点。
     *
     * @param categoryId 分类 ID
     * @param name       规范化考点名
     * @return 考点，不存在时为 null
     */
    @Select("""
            SELECT id, category_id, name, slug, parent_id, hot_score, hot_score_source,
                   status, description, create_time, update_time, is_deleted
            FROM knowledge_point
            WHERE category_id = #{categoryId} AND name = #{name}
            LIMIT 1
            """)
    KnowledgePoint selectByCategoryAndName(@Param("categoryId") Long categoryId,
                                            @Param("name") String name);

    /**
     * 查询高频考点排行：按 hot_score 倒序，附带分类名和语料/题目聚合统计。
     * 仅返回有权重且未删除的考点，未发布题目不计入覆盖数。
     *
     * @param categoryId 分类 ID，可为空（不筛选）
     * @param size       返回条数
     * @return 考点排行行
     */
    @Select("""
            <script>
            SELECT kp.id, kp.name, kp.category_id, c.name AS category_name,
                   kp.hot_score, kp.hot_score_source,
                   COALESCE(m.total, 0) AS mention_total,
                   COALESCE(m.docs, 0) AS doc_count,
                   COALESCE(q.total, 0) AS question_count
            FROM knowledge_point kp
            LEFT JOIN category c ON c.id = kp.category_id AND c.is_deleted = 0
            LEFT JOIN (
                SELECT kpm.knowledge_point_id AS kp_id,
                       SUM(kpm.mention_count) AS total,
                       COUNT(DISTINCT kpm.interview_source_id) AS docs
                FROM knowledge_point_mention kpm
                INNER JOIN interview_source src ON src.id = kpm.interview_source_id
                WHERE kpm.is_deleted = 0
                  AND src.is_deleted = 0
                  AND src.status = 'EXTRACTED'
                GROUP BY kpm.knowledge_point_id
            ) m ON m.kp_id = kp.id
            LEFT JOIN (
                SELECT qkp.knowledge_point_id AS kp_id, COUNT(DISTINCT q.id) AS total
                FROM question_knowledge_point qkp
                INNER JOIN question q ON q.id = qkp.question_id
                WHERE q.is_deleted = 0
                  AND q.status = 'PUBLISHED'
                GROUP BY qkp.knowledge_point_id
            ) q ON q.kp_id = kp.id
            WHERE kp.is_deleted = 0
              AND kp.hot_score > 0
              <if test="categoryId != null">
              AND kp.category_id = #{categoryId}
              </if>
            ORDER BY kp.hot_score DESC, kp.id DESC
            LIMIT #{size}
            </script>
            """)
    List<HotPointRow> selectHotPoints(@Param("categoryId") Long categoryId,
                                      @Param("size") int size);

    /**
     * 考点排行聚合行。
     *
     * @param id          考点 ID
     * @param name        考点名称
     * @param categoryId  分类 ID
     * @param categoryName 分类名称
     * @param hotScore    权重分
     * @param hotScoreSource 权重来源
     * @param mentionTotal 提及总次数
     * @param docCount    覆盖语料篇数
     * @param questionCount 关联已发布题目数
     */
    record HotPointRow(Long id, String name, Long categoryId, String categoryName,
                       Integer hotScore, String hotScoreSource,
                       Long mentionTotal, Long docCount, Long questionCount) {
    }
}
