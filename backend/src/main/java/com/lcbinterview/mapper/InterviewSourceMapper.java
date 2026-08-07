package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.InterviewSource;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 面经语料 Mapper。
 */
public interface InterviewSourceMapper extends BaseMapper<InterviewSource> {

    /**
     * 按来源 URL 幂等导入语料。
     *
     * @param source 语料实体
     * @return 新增行数，重复 URL 返回 0
     */
    @Insert("""
            INSERT IGNORE INTO interview_source (
                source_url, source_name, company, position, publish_date, raw_content,
                status, extract_error, create_time, update_time, is_deleted
            ) VALUES (
                #{sourceUrl}, #{sourceName}, #{company}, #{position}, #{publishDate}, #{rawContent},
                'RAW', '', NOW(), NOW(), 0
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertIgnore(InterviewSource source);

    /**
     * 查询当前 RAW/FAILED 语料最大 ID，作为本轮任务高水位。
     *
     * @return 最大 ID，无待处理语料时为 null
     */
    @Select("SELECT MAX(id) FROM interview_source WHERE status IN ('RAW', 'FAILED') AND is_deleted = 0")
    Long selectMaxPendingId();

    /**
     * 统计高水位以内 RAW/FAILED 待提取语料数。
     *
     * @param maxId 本轮最大 ID
     * @return 待处理数量
     */
    @Select("""
            SELECT COUNT(*) FROM interview_source
            WHERE status IN ('RAW', 'FAILED') AND is_deleted = 0 AND id <= #{maxId}
            """)
    long countPendingUpTo(@Param("maxId") long maxId);

    /**
     * 使用 ID 游标查询本轮下一批 RAW/FAILED 语料。
     *
     * @param lastId 上一批最后 ID
     * @param maxId  本轮高水位 ID
     * @param size   批大小
     * @return 下一批语料
     */
    @Select("""
            SELECT id, source_url, source_name, company, position, publish_date, raw_content,
                   status, extract_error, create_time, update_time, is_deleted
            FROM interview_source
            WHERE status IN ('RAW', 'FAILED') AND is_deleted = 0
              AND id > #{lastId} AND id <= #{maxId}
            ORDER BY id ASC
            LIMIT #{size}
            """)
    List<InterviewSource> selectPendingBatchAfter(@Param("lastId") long lastId,
                                                   @Param("maxId") long maxId,
                                                   @Param("size") int size);

    /**
     * 将待处理语料标记为已提取并更新 AI 识别元数据。
     *
     * @param id       语料 ID
     * @param company  公司
     * @param position 岗位
     * @return 更新行数
     */
    @Update("""
            UPDATE interview_source
            SET status = 'EXTRACTED', company = #{company}, position = #{position},
                extract_error = '', update_time = NOW()
            WHERE id = #{id} AND status IN ('RAW', 'FAILED') AND is_deleted = 0
            """)
    int markExtracted(@Param("id") Long id, @Param("company") String company,
                      @Param("position") String position);

    /**
     * 将待处理语料标记为失败，避免覆盖其他实例已完成的结果。
     *
     * @param id    语料 ID
     * @param error 失败原因
     * @return 更新行数
     */
    @Update("""
            UPDATE interview_source
            SET status = 'FAILED', extract_error = #{error}, update_time = NOW()
            WHERE id = #{id} AND status IN ('RAW', 'FAILED') AND is_deleted = 0
            """)
    int markFailed(@Param("id") Long id, @Param("error") String error);
}
