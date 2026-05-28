package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.Question;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/**
 * 题目 Mapper。复杂查询用 @Select 注解 + Text Block SQL。
 */
public interface QuestionMapper extends BaseMapper<Question> {

    /**
     * 查询热门题目，按浏览次数倒序。
     *
     * @param size 取前 N 条
     * @return 热门题目列表
     */
    @Select("""
            SELECT id, category_id, title, content, answer,
                   difficulty, view_count, create_time, update_time
            FROM question
            WHERE is_deleted = 0
            ORDER BY view_count DESC
            LIMIT #{size}
            """)
    List<Question> selectHot(@Param("size") int size);

    /**
     * 根据标签 ID 查询关联题目。
     *
     * @param tagId 标签 ID
     * @return 题目列表
     */
    @Select("""
            SELECT q.id, q.category_id, q.title, q.content, q.answer,
                   q.difficulty, q.view_count, q.create_time, q.update_time
            FROM question q
            INNER JOIN question_tag qt ON q.id = qt.question_id
            WHERE qt.tag_id = #{tagId} AND q.is_deleted = 0
            ORDER BY q.create_time DESC
            """)
    List<Question> selectByTagId(@Param("tagId") Long tagId);
}
