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

    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String SORT_HOT = "hot";
    private static final String SORT_LATEST = "latest";
    private static final String SORT_RELEVANCE = "relevance";

    private final QuestionMapper questionMapper;
    private final ViewCountService viewCountService;
    private final CategoryMapper categoryMapper;

    /**
     * 分页搜索题目。支持分类筛选、难度筛选、关键词全文搜索、标签筛选。
     * 关键词搜索走 MySQL FULLTEXT INDEX（ngram 中文分词）。
     */
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size) {
        return search(categoryId, difficulty, keyword, tagId, page, size, null);
    }

    /**
     * 分页搜索题目，并按安全白名单解析排序方式。
     *
     * @param categoryId 分类 ID，可选
     * @param difficulty 难度，可选
     * @param keyword    搜索关键词，可选
     * @param tagId      标签 ID，可选
     * @param page       页码，从 0 开始
     * @param size       每页条数
     * @param sort       排序方式：latest / hot / relevance
     * @return MyBatis-Plus 分页结果
     */
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size, String sort) {
        int safePage = normalizePage(page);
        int safeSize = normalizeSize(size);
        String safeSort = normalizeSort(sort, StringUtils.isNotBlank(keyword));
        Page<Question> mpPage = new Page<>(safePage + 1L, safeSize);

        if (tagId != null) {
            log.info("按标签筛选题目，tagId={}, page={}, size={}", tagId, safePage, safeSize);
            return questionMapper.selectPageByTagId(mpPage, tagId, safeSort);
        }

        if (StringUtils.isNotBlank(keyword)) {
            log.info("全文搜索 keyword={}, categoryId={}, difficulty={}", keyword, categoryId, difficulty);
            IPage<Question> fulltextResult = questionMapper.searchFulltext(mpPage, keyword, categoryId, difficulty, safeSort);
            if (!fulltextResult.getRecords().isEmpty()) {
                return fulltextResult;
            }
            // MySQL FULLTEXT 对英文短词和部分混合词不稳定，兜底 LIKE 保证用户能搜到标题中的显式关键词。
            log.info("全文搜索未命中，使用 LIKE 兜底搜索 keyword={}", keyword);
            return questionMapper.searchLike(new Page<>(safePage + 1L, safeSize), keyword, categoryId, difficulty, safeSort);
        }

        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, "PUBLISHED")
                .eq(categoryId != null, Question::getCategoryId, categoryId)
                .eq(StringUtils.isNotBlank(difficulty), Question::getDifficulty, difficulty);

        if (SORT_HOT.equals(safeSort)) {
            wrapper.orderByDesc(Question::getViewCount)
                    .orderByDesc(Question::getCreateTime);
        } else {
            wrapper.orderByDesc(Question::getCreateTime);
        }

        log.info("搜索题目: categoryId={}, difficulty={}, keyword={}, page={}, size={}",
                categoryId, difficulty, keyword, safePage, safeSize);
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
        return searchVo(categoryId, difficulty, keyword, tagId, page, size, null);
    }

    /**
     * 分页搜索题目并按排序方式组装 VO。
     *
     * @param categoryId 分类 ID，可选
     * @param difficulty 难度，可选
     * @param keyword    搜索关键词，可选
     * @param tagId      标签 ID，可选
     * @param page       页码，从 0 开始
     * @param size       每页条数
     * @param sort       排序方式：latest / hot / relevance
     * @return 题目分页 VO
     */
    public PageResult<QuestionVO> searchVo(Long categoryId, String difficulty, String keyword,
                                           Long tagId, int page, int size, String sort) {
        IPage<Question> result = search(categoryId, difficulty, keyword, tagId, page, size, sort);
        return PageResult.of(result, toVos(result.getRecords()));
    }

    /**
     * 获取题目详情。同时异步累加浏览次数。
     *
     * @throws BusinessException 题目不存在时抛 404
     */
    public Question getById(Long id) {
        Question question = loadQuestionOrThrow(id);
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
        Question question = loadQuestionOrThrow(id);
        if (!"PUBLISHED".equals(question.getStatus())) {
            throw new BusinessException(404, "题目不存在");
        }
        viewCountService.increment(id);
        log.info("查看题目详情，id={}, title={}", id, question.getTitle());
        QuestionVO detail = toVos(List.of(question)).getFirst();
        return detail.withNavigation(findPreviousQuestionId(question), findNextQuestionId(question));
    }

    /**
     * 获取热门题目 Top N。结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "hotQuestions")
    public List<Question> getHot(int size) {
        int safeSize = normalizeSize(size);
        log.info("缓存未命中，从数据库加载热门题目 Top {}", safeSize);
        return questionMapper.selectHot(safeSize);
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

    /**
     * 按 ID 列表批量查询已发布题目，并组装 VO。
     * 用于详情页关联题目渲染：传入 relatedIds 解析后的 ID 列表，返回同分类或跨分类的相关题。
     * 仅返回 PUBLISHED 题目，过滤草稿/驳回，避免通过关联 ID 暴露未发布内容。
     * 上限 20 条，对输入去重并剔除无效/非正 ID。
     */
    public List<QuestionVO> listPublishedVosByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        // 解析关联 ID 列表后立即做去重和数值校验，避免脏数据放大查询压力。
        List<Long> distinctIds = ids.stream()
                .filter(Objects::nonNull)
                .filter(id -> id > 0)
                .distinct()
                .limit(20)
                .toList();
        if (distinctIds.isEmpty()) {
            return List.of();
        }
        List<Question> questions = questionMapper.selectBatchIds(distinctIds);
        if (questions == null || questions.isEmpty()) {
            return List.of();
        }
        // 仅返回已发布题目；按传入顺序排序，保证关联题目展示稳定。
        List<Question> published = questions.stream()
                .filter(q -> "PUBLISHED".equals(q.getStatus()))
                .toList();
        return toVos(published);
    }

    private int normalizePage(int page) {
        return Math.max(0, page);
    }

    private int normalizeSize(int size) {
        return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, size));
    }

    private String normalizeSort(String sort, boolean hasKeyword) {
        if (SORT_HOT.equalsIgnoreCase(sort)) {
            return SORT_HOT;
        }
        if (SORT_LATEST.equalsIgnoreCase(sort)) {
            return SORT_LATEST;
        }
        if (SORT_RELEVANCE.equalsIgnoreCase(sort)) {
            return SORT_RELEVANCE;
        }
        return hasKeyword ? SORT_RELEVANCE : SORT_LATEST;
    }

    private Question loadQuestionOrThrow(Long id) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            log.warn("题目不存在，id={}", id);
            throw new BusinessException(404, "题目不存在");
        }
        return question;
    }

    private Long findPreviousQuestionId(Question question) {
        if (question.getCategoryId() == null || question.getId() == null) {
            return null;
        }
        Question previous = questionMapper.selectOne(new LambdaQueryWrapper<Question>()
                .select(Question::getId)
                .eq(Question::getStatus, "PUBLISHED")
                .eq(Question::getCategoryId, question.getCategoryId())
                .lt(Question::getId, question.getId())
                .orderByDesc(Question::getId)
                .last("LIMIT 1"));
        return previous == null ? null : previous.getId();
    }

    private Long findNextQuestionId(Question question) {
        if (question.getCategoryId() == null || question.getId() == null) {
            return null;
        }
        Question next = questionMapper.selectOne(new LambdaQueryWrapper<Question>()
                .select(Question::getId)
                .eq(Question::getStatus, "PUBLISHED")
                .eq(Question::getCategoryId, question.getCategoryId())
                .gt(Question::getId, question.getId())
                .orderByAsc(Question::getId)
                .last("LIMIT 1"));
        return next == null ? null : next.getId();
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
