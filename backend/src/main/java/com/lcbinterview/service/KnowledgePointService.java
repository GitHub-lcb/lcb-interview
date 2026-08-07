package com.lcbinterview.service;

import com.lcbinterview.dto.KnowledgePointVO;
import com.lcbinterview.mapper.KnowledgePointMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 高频考点公开服务：考点排行与考点下题目查询。
 * 读多写少，排行结果缓存 Redis TTL 10 分钟，权重变化时由管理接口主动失效。
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgePointService {

    private static final int MIN_SIZE = 1;
    private static final int MAX_SIZE = 100;

    private final KnowledgePointMapper knowledgePointMapper;

    /**
     * 失效考点排行缓存。权重重算后调用，保证公开页及时更新。
     */
    @CacheEvict(value = "hotKnowledgePoints", allEntries = true)
    public void evictHotCache() {
        log.info("失效高频考点排行缓存");
    }

    /**
     * 查询高频考点排行，按 hot_score 倒序。
     *
     * @param categoryId 分类 ID，可选
     * @param size       返回条数，默认 20，上限 100
     * @return 考点排行列表
     */
    @Cacheable(value = "hotKnowledgePoints")
    public List<KnowledgePointVO> hotPoints(Long categoryId, int size) {
        int safeSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
        List<KnowledgePointMapper.HotPointRow> rows = knowledgePointMapper.selectHotPoints(categoryId, safeSize);
        log.info("查询高频考点排行: categoryId={}, size={}, 命中 {} 条", categoryId, safeSize, rows.size());
        return rows.stream().map(row -> new KnowledgePointVO(
                row.id(), row.name(), row.categoryId(), row.categoryName(),
                row.hotScore(), row.hotScoreSource(),
                row.mentionTotal(), row.docCount(), row.questionCount())).toList();
    }
}
