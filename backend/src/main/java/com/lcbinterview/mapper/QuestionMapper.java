package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.dto.QuestionTagName;
import com.lcbinterview.model.Question;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/**
 * 题目 Mapper。复杂查询用 @Select 注解 + Text Block SQL。
 * @author chongan
 */
public interface QuestionMapper extends BaseMapper<Question> {

    /**
     * 查询热门题目，按浏览次数倒序（仅已发布）。
     */
    @Select("""
            SELECT id, category_id, title, summary, content, principle,
                   comparison, scenario, risk, project_exp,
                   code_examples, diagrams, related_ids,
                   difficulty, view_count, status, source,
                   create_time, update_time
            FROM question
            WHERE status = 'PUBLISHED' AND is_deleted = 0
            ORDER BY view_count DESC
            LIMIT #{size}
            """)
    List<Question> selectHot(@Param("size") int size);

    /**
     * 根据标签 ID 查询关联题目（仅已发布）。
     */
    @Select("""
            SELECT q.id, q.category_id, q.title, q.summary, q.content,
                   q.principle, q.comparison, q.scenario, q.risk,
                   q.project_exp, q.code_examples, q.diagrams, q.related_ids,
                   q.difficulty, q.view_count, q.status, q.source,
                   q.create_time, q.update_time
            FROM question q
            INNER JOIN question_tag qt ON q.id = qt.question_id
            WHERE qt.tag_id = #{tagId}
              AND q.status = 'PUBLISHED' AND q.is_deleted = 0
            ORDER BY q.create_time DESC
            """)
    List<Question> selectByTagId(@Param("tagId") Long tagId);

    /**
     * 根据标签 ID 分页查询关联题目（仅已发布）。
     */
    @Select("""
            SELECT q.id, q.category_id, q.title, q.summary, q.content,
                   q.principle, q.comparison, q.scenario, q.risk,
                   q.project_exp, q.code_examples, q.diagrams, q.related_ids,
                   q.difficulty, q.view_count, q.status, q.source,
                   q.create_time, q.update_time
            FROM question q
            INNER JOIN question_tag qt ON q.id = qt.question_id
            WHERE qt.tag_id = #{tagId}
              AND q.status = 'PUBLISHED' AND q.is_deleted = 0
            ORDER BY q.create_time DESC
            """)
    IPage<Question> selectPageByTagId(Page<?> page, @Param("tagId") Long tagId);

    /**
     * 批量查询题目关联的标签名，用于组装列表页和详情页 VO。
     */
    @Select("""
            <script>
            SELECT qt.question_id AS questionId, t.name AS tagName
            FROM question_tag qt
            INNER JOIN tag t ON qt.tag_id = t.id
            WHERE qt.question_id IN
            <foreach collection="questionIds" item="questionId" open="(" separator="," close=")">
                #{questionId}
            </foreach>
              AND t.is_deleted = 0
            ORDER BY qt.question_id ASC, t.id ASC
            </script>
            """)
    List<QuestionTagName> selectTagNamesByQuestionIds(@Param("questionIds") List<Long> questionIds);

    /**
     * 全文搜索题目（FULLTEXT + ngram），支持分类+难度组合筛选。
     */
    @Select("""
            <script>
            SELECT id, category_id, title, summary, content, principle,
                   comparison, scenario, risk, project_exp,
                   code_examples, diagrams, related_ids,
                   difficulty, view_count, status, source,
                   create_time, update_time
            FROM question
            WHERE status = 'PUBLISHED' AND is_deleted = 0
              AND MATCH(title, summary, principle, content, scenario, project_exp)
                  AGAINST(#{keyword} IN BOOLEAN MODE)
              <if test="categoryId != null">
              AND category_id = #{categoryId}
              </if>
              <if test="difficulty != null and difficulty != ''">
              AND difficulty = #{difficulty}
              </if>
            ORDER BY
              CASE WHEN title LIKE CONCAT('%', #{keyword}, '%') THEN 0 ELSE 1 END,
              view_count DESC
            </script>
            """)
    IPage<Question> searchFulltext(Page<?> page, @Param("keyword") String keyword,
                                    @Param("categoryId") Long categoryId,
                                    @Param("difficulty") String difficulty);

    /**
     * LIKE 兜底搜索题目（仅已发布）。用于 FULLTEXT 未命中英文短词或中英混合关键词时保证可检索。
     */
    @Select("""
            <script>
            SELECT id, category_id, title, summary, content, principle,
                   comparison, scenario, risk, project_exp,
                   code_examples, diagrams, related_ids,
                   difficulty, view_count, status, source,
                   create_time, update_time
            FROM question
            WHERE status = 'PUBLISHED' AND is_deleted = 0
              AND (
                title LIKE CONCAT('%', #{keyword}, '%')
                OR summary LIKE CONCAT('%', #{keyword}, '%')
                OR content LIKE CONCAT('%', #{keyword}, '%')
                OR principle LIKE CONCAT('%', #{keyword}, '%')
                OR comparison LIKE CONCAT('%', #{keyword}, '%')
                OR scenario LIKE CONCAT('%', #{keyword}, '%')
                OR risk LIKE CONCAT('%', #{keyword}, '%')
                OR project_exp LIKE CONCAT('%', #{keyword}, '%')
              )
              <if test="categoryId != null">
              AND category_id = #{categoryId}
              </if>
              <if test="difficulty != null and difficulty != ''">
              AND difficulty = #{difficulty}
              </if>
            ORDER BY
              CASE WHEN title LIKE CONCAT('%', #{keyword}, '%') THEN 0 ELSE 1 END,
              view_count DESC
            </script>
            """)
    IPage<Question> searchLike(Page<?> page, @Param("keyword") String keyword,
                               @Param("categoryId") Long categoryId,
                               @Param("difficulty") String difficulty);
}
