package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.model.Category;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/**
 * 分类 Service。缓存全部分类列表，支持按 ID 查询。
 * @author chongan
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryMapper categoryMapper;

    /**
     * 获取全部分类，按 sortOrder 升序。
     * 结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "categories")
    public List<Category> getAll() {
        log.info("缓存未命中，从数据库加载全部分类");
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<Category>()
                .orderByAsc(Category::getSortOrder);
        return categoryMapper.selectList(wrapper);
    }

    /**
     * 根据 ID 获取分类详情。
     *
     * @throws BusinessException 分类不存在时抛 404
     */
    public Category getById(Long id) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            log.warn("分类不存在，id={}", id);
            throw new BusinessException(404, "分类不存在");
        }
        return category;
    }
}
