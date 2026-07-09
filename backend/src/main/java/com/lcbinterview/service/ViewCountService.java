package com.lcbinterview.service;

import com.lcbinterview.mapper.QuestionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 浏览次数计数器。
 * <p>
 * 采用生产者-消费者模式避免高并发下热点行锁：
 * <ul>
 *   <li>生产者 — increment() 每次浏览请求触发，内存累加无锁竞争</li>
 *   <li>消费者 — flush() 每隔 5 分钟批量写入 DB</li>
 * </ul>
 * <p>
 * 安全要点：先成功写入 DB 再清空缓冲区，避免写库失败导致数据丢失。
 * 使用原子 UPDATE SET view_count = view_count + ? 批量更新，避免逐条 selectById + updateById。
 * @author chongan
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ViewCountService {

    private final QuestionMapper questionMapper;
    private final Map<Long, Integer> buffer = new ConcurrentHashMap<>();

    /**
     * 累加题目浏览次数。线程安全，无锁。
     *
     * @param questionId 题目 ID
     */
    public void increment(Long questionId) {
        buffer.merge(questionId, 1, Integer::sum);
    }

    /**
     * 定时批量写入浏览数到数据库。每 5 分钟执行一次。
     * 先写入 DB 成功后再清空缓冲区，避免写库失败导致数据丢失。
     * 使用原子 UPDATE 批量更新，避免逐条查询+更新的 N+1 问题。
     */
    @Scheduled(fixedRate = 300_000)
    @Transactional
    public void flush() {
        if (buffer.isEmpty()) {
            return;
        }
        // 快照当前缓冲区，但不立即清空；写库成功后再清空
        var snapshot = Map.copyOf(buffer);
        int updated = 0;
        List<Long> failedIds = new ArrayList<>();
        for (var entry : snapshot.entrySet()) {
            try {
                // 原子更新：view_count = view_count + delta，无需先查询再更新
                int rows = questionMapper.incrementViewCount(entry.getKey(), entry.getValue());
                if (rows > 0) {
                    updated++;
                } else {
                    // 题目可能已被逻辑删除，记录但不影响其他题目
                    failedIds.add(entry.getKey());
                }
            } catch (Exception e) {
                log.warn("更新浏览数失败: questionId={}, delta={}, error={}", entry.getKey(), entry.getValue(), e.getMessage());
                failedIds.add(entry.getKey());
            }
        }
        // 只移除成功更新的条目，保留失败条目下次重试
        for (var entry : snapshot.entrySet()) {
            if (!failedIds.contains(entry.getKey())) {
                // 精确移除：仅当值未变时才移除，避免移除 flush 期间新增的计数
                buffer.remove(entry.getKey(), entry.getValue());
            }
        }
        log.info("定时刷新浏览数完成，共更新 {} 道题（缓存 {} 道，失败 {} 道）",
                updated, snapshot.size(), failedIds.size());
    }
}
