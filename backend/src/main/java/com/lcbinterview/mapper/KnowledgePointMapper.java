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
}
