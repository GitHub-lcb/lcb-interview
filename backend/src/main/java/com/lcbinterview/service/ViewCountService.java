package com.lcbinterview.service;

import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
     */
    @Scheduled(fixedRate = 300_000)
    @Transactional
    public void flush() {
        if (buffer.isEmpty()) {
            return;
        }
        var snapshot = Map.copyOf(buffer);
        buffer.clear();
        int updated = 0;
        for (var entry : snapshot.entrySet()) {
            Question question = questionMapper.selectById(entry.getKey());
            if (question != null) {
                question.setViewCount(question.getViewCount() + entry.getValue());
                questionMapper.updateById(question);
                updated++;
            }
        }
        log.info("定时刷新浏览数完成，共更新 {} 道题（缓存 {} 道）", updated, snapshot.size());
    }
}
