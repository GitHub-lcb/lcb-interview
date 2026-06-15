package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.QuestionTagName;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 题目 Service。处理题目的分页搜索、详情查看、热门排行等业务。
 * 查询方法标记 @Transactional(readOnly = true) 提升性能。
 * @author chongan
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionService {

    private final QuestionMapper questionMapper;
    private final ViewCountService viewCountService;
    private final CategoryMapper categoryMapper;

    /**
     * 分页搜索题目。支持分类筛选、难度筛选、关键词全文搜索、标签筛选。
     * 关键词搜索走 MySQL FULLTEXT INDEX（ngram 中文分词）。
     */
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size) {
        Page<Question> mpPage = new Page<>(page + 1, size);

        if (tagId != null) {
            log.info("按标签筛选题目，tagId={}, page={}, size={}", tagId, page, size);
            return questionMapper.selectPageByTagId(mpPage, tagId);
        }

        if (StringUtils.isNotBlank(keyword)) {
            log.info("全文搜索 keyword={}, categoryId={}, difficulty={}", keyword, categoryId, difficulty);
            return questionMapper.searchFulltext(mpPage, keyword, categoryId, difficulty);
        }

        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, "PUBLISHED")
                .eq(categoryId != null, Question::getCategoryId, categoryId)
                .eq(StringUtils.isNotBlank(difficulty), Question::getDifficulty, difficulty)
                .orderByDesc(Question::getCreateTime);

        log.info("搜索题目: categoryId={}, difficulty={}, keyword={}, page={}, size={}",
                categoryId, difficulty, keyword, page, size);
        return questionMapper.selectPage(mpPage, wrapper);
    }

    /**
     * 分页搜索题目并组装分类名、标签名等前端展示字段。
     *
     * @param categoryId 分类 ID，可选
     * @param difficulty 难度，可选
     * @param keyword    搜索关键词，可选
     * @param tagId      标签 ID，可选
     * @param page       页码，从 0 开始
     * @param size       每页条数
     * @return 题目分页 VO
     */
    public PageResult<QuestionVO> searchVo(Long categoryId, String difficulty, String keyword,
                                           Long tagId, int page, int size) {
        IPage<Question> result = search(categoryId, difficulty, keyword, tagId, page, size);
        return PageResult.of(result, toVos(result.getRecords()));
    }

    /**
     * 获取题目详情。同时异步累加浏览次数。
     *
     * @throws BusinessException 题目不存在时抛 404
     */
    public Question getById(Long id) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            log.warn("题目不存在，id={}", id);
            throw new BusinessException(404, "题目不存在");
        }
        viewCountService.increment(id);
        log.info("查看题目详情，id={}, title={}", id, question.getTitle());
        return question;
    }

    /**
     * 获取题目详情 VO，仅允许查看已发布题目。
     *
     * @param id 题目 ID
     * @return 题目详情 VO
     */
    public QuestionVO getVoById(Long id) {
        Question question = getById(id);
        if (!"PUBLISHED".equals(question.getStatus())) {
            throw new BusinessException(404, "题目不存在");
        }
        return toVos(List.of(question)).getFirst();
    }

    /**
     * 获取热门题目 Top N。结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "hotQuestions")
    public List<Question> getHot(int size) {
        log.info("缓存未命中，从数据库加载热门题目 Top {}", size);
        return questionMapper.selectHot(size);
    }

    /**
     * 获取热门题目 VO。
     *
     * @param size 返回条数
     * @return 热门题目 VO 列表
     */
    @Cacheable(value = "hotQuestionVos")
    public List<QuestionVO> getHotVo(int size) {
        return toVos(getHot(size));
    }

    private List<QuestionVO> toVos(List<Question> questions) {
        if (questions == null || questions.isEmpty()) {
            return List.of();
        }
        Map<Long, String> categoryNames = loadCategoryNames(questions);
        Map<Long, List<String>> tags = loadTags(questions);
        return questions.stream()
                .map(q -> QuestionVO.from(
                        q,
                        categoryNames.get(q.getCategoryId()),
                        tags.getOrDefault(q.getId(), List.of())))
                .toList();
    }

    private Map<Long, String> loadCategoryNames(List<Question> questions) {
        List<Long> categoryIds = questions.stream()
                .map(Question::getCategoryId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (categoryIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> result = new HashMap<>();
        for (Category category : categoryMapper.selectBatchIds(categoryIds)) {
            result.put(category.getId(), category.getName());
        }
        return result;
    }

    private Map<Long, List<String>> loadTags(List<Question> questions) {
        List<Long> questionIds = questions.stream()
                .map(Question::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (questionIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<String>> result = new HashMap<>();
        for (QuestionTagName row : questionMapper.selectTagNamesByQuestionIds(questionIds)) {
            result.computeIfAbsent(row.questionId(), id -> new ArrayList<>()).add(row.tagName());
        }
        return result;
    }
}
