package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.QuestionTag;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;

/**
 * 题目标签关联 Mapper。
 */
public interface QuestionTagMapper extends BaseMapper<QuestionTag> {

    /**
     * 幂等写入题目标签关联，并发重复写入时安全忽略。
     *
     * @param questionId 题目 ID
     * @param tagId      标签 ID
     * @return 新增行数
     */
    @Insert("""
            INSERT IGNORE INTO question_tag (question_id, tag_id)
            VALUES (#{questionId}, #{tagId})
            """)
    int insertIgnore(@Param("questionId") Long questionId, @Param("tagId") Long tagId);
}
