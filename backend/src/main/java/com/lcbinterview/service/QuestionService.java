package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

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

    /**
     * 分页搜索题目。支持分类筛选、难度筛选、关键词全文搜索、标签筛选。
     * 关键词搜索走 MySQL FULLTEXT INDEX（ngram 中文分词）。
     */
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size) {
        Page<Question> mpPage = new Page<>(page, size);

        if (tagId != null) {
            log.info("按标签筛选题目，tagId={}, page={}, size={}", tagId, page, size);
            List<Question> list = questionMapper.selectByTagId(tagId);
            mpPage.setRecords(list);
            mpPage.setTotal(list.size());
            return mpPage;
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
     * 获取热门题目 Top N。结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "hotQuestions")
    public List<Question> getHot(int size) {
        log.info("缓存未命中，从数据库加载热门题目 Top {}", size);
        return questionMapper.selectHot(size);
    }
}
