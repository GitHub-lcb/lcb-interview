package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.KnowledgePointMention;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 考点提及统计 Mapper。
 */
public interface KnowledgePointMentionMapper extends BaseMapper<KnowledgePointMention> {

    /**
     * 按考点聚合语料提及频次与覆盖篇数，供权重计算使用（SQL 聚合避免全量加载明细）。
     *
     * @return 考点级聚合行
     */
    @Select("""
            SELECT kpm.knowledge_point_id AS kp_id,
                   SUM(kpm.mention_count) AS total,
                   COUNT(DISTINCT kpm.interview_source_id) AS docs
            FROM knowledge_point_mention kpm
            INNER JOIN interview_source src ON src.id = kpm.interview_source_id
            INNER JOIN knowledge_point kp ON kp.id = kpm.knowledge_point_id
            WHERE kpm.is_deleted = 0
              AND kpm.mention_count > 0
              AND src.is_deleted = 0
              AND src.status = 'EXTRACTED'
              AND kp.is_deleted = 0
            GROUP BY kpm.knowledge_point_id
            """)
    List<MentionStat> selectMentionStats();

    /**
     * 按语料和考点原子写入提及，重复提取时覆盖统计而不是累加重复行。
     *
     * @param mention 提及数据
     * @return MySQL 受影响行数，1 表示新增，其他值表示更新
     */
    @Insert("""
            INSERT INTO knowledge_point_mention (
                interview_source_id, knowledge_point_id, mention_count, context,
                create_time, is_deleted
            ) VALUES (
                #{interviewSourceId}, #{knowledgePointId}, #{mentionCount}, #{context}, NOW(), 0
            )
            ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id),
                mention_count = VALUES(mention_count),
                context = VALUES(context),
                is_deleted = 0
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int upsertMention(KnowledgePointMention mention);

    /**
     * 考点提及聚合行。
     *
     * @param kpId  考点 ID
     * @param total 提及总次数
     * @param docs  覆盖语料篇数
     */
    record MentionStat(Long kpId, Long total, Long docs) {
    }
}
