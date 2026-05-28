package com.lcbinterview.service;

import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.*;

/**
 * AI 题目生成服务。支持异步批量生成，前端轮询任务状态。
 * 内存存储生成任务状态（简化方案，重启后丢失。后续可改为 Redis 或 DB 持久化）。
 * @author chongan
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiQuestionService {

    private final QuestionMapper questionMapper;
    private final Map<Long, GenerationTaskVO> taskStore = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    /**
     * 异步生成题目。
     *
     * @param req 生成参数
     * @return 任务 ID
     */
    public Long generate(GenerationRequest req) {
        Long taskId = System.currentTimeMillis();
        taskStore.put(taskId, new GenerationTaskVO(taskId, "RUNNING", req.count(), 0, 0, List.of(), List.of()));

        scheduler.submit(() -> {
            try {
                List<String> errors = new ArrayList<>();
                List<Long> generatedIds = new ArrayList<>();
                int success = 0;
                int fail = 0;

                for (int i = 0; i < req.count(); i++) {
                    try {
                        // TODO: 接入实际 LLM API，此处为模拟生成
                        Question q = new Question();
                        q.setTitle(req.category() + " 面试题 " + (i + 1));
                        q.setSummary("这是 " + req.category() + " 相关的面试题摘要");
                        q.setContent("详细内容...");
                        q.setPrinciple("原理...");
                        q.setDifficulty(req.difficulty() != null ? req.difficulty() : "MEDIUM");
                        q.setCategoryId(1L);
                        q.setStatus("DRAFT");
                        q.setSource("AI_GENERATED");
                        questionMapper.insert(q);
                        generatedIds.add(q.getId());
                        success++;
                    } catch (Exception e) {
                        log.error("生成单题失败", e);
                        errors.add("第 " + (i + 1) + " 题生成失败: " + e.getMessage());
                        fail++;
                    }

                    String taskStatus = fail == 0 ? "COMPLETED" : (success > 0 ? "PARTIAL" : "FAILED");
                    taskStore.put(taskId, new GenerationTaskVO(
                            taskId, taskStatus, req.count(), success, fail,
                            List.copyOf(errors), List.copyOf(generatedIds)));
                }
            } catch (Exception e) {
                log.error("生成任务异常", e);
                taskStore.put(taskId, new GenerationTaskVO(
                        taskId, "FAILED", req.count(), 0, req.count(),
                        List.of("任务执行异常: " + e.getMessage()), List.of()));
            }
        });

        return taskId;
    }

    /**
     * 查询生成任务状态。
     */
    public GenerationTaskVO getTask(Long taskId) {
        return taskStore.get(taskId);
    }
}
