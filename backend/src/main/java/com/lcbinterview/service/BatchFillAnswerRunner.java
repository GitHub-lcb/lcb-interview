package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lcbinterview.dto.BatchProgressVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 后台批量补答案任务执行器。负责启动异步补答案任务并提供进度快照。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BatchFillAnswerRunner {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final int MAX_ERROR_RECORDS = 50;

    private final QuestionMapper questionMapper;
    private final AiQuestionService aiQuestionService;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicReference<BatchProgressVO> progress = new AtomicReference<>(
            new BatchProgressVO("IDLE", 0, 0, 0, 0, 0, null, null, List.of()));
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * 启动后台批量补答案任务。
     *
     * @param categoryId 分类 ID，可选
     * @param maxQuestions 本次最大处理题数，可选
     * @param delaySeconds 每题处理后的等待秒数
     * @return true 表示任务已启动，false 表示已有任务运行中
     */
    public boolean start(Long categoryId, Integer maxQuestions, int delaySeconds) {
        if (!running.compareAndSet(false, true)) {
            log.warn("批量补答案任务已在运行中，拒绝新请求");
            return false;
        }

        int safeDelaySeconds = Math.max(0, delaySeconds);
        Integer safeMaxQuestions = maxQuestions == null || maxQuestions <= 0 ? null : maxQuestions;
        progress.set(new BatchProgressVO(
                "RUNNING", 0, 0, 0, 0, 0, null, "准备批量补答案...", List.of()));

        executor.submit(() -> {
            try {
                runBatch(categoryId, safeMaxQuestions, safeDelaySeconds);
            } catch (Exception e) {
                log.error("批量补答案任务异常终止", e);
                progress.set(new BatchProgressVO(
                        "FAILED", 0, 0, 0, 0, 1, null, "批量补答案任务异常终止",
                        List.of(e.getMessage())));
            } finally {
                running.set(false);
                log.info("批量补答案任务已释放运行锁");
            }
        });
        return true;
    }

    /**
     * 查询当前后台批量补答案进度。
     *
     * @return 当前进度快照
     */
    public BatchProgressVO getProgress() {
        return progress.get();
    }

    private void runBatch(Long categoryId, Integer maxQuestions, int delaySeconds) {
        long available = questionMapper.selectCount(buildCandidateWrapper(categoryId, null));
        int total = normalizeTotal(available, maxQuestions);
        List<String> errors = new ArrayList<>();
        log.info("批量补答案启动: categoryId={}, maxQuestions={}, delay={}s, 待处理={}题",
                categoryId, maxQuestions, delaySeconds, total);

        progress.set(new BatchProgressVO(
                "RUNNING", 0, 0, total, 0, 0, null, "加载待补题目...", List.of()));
        if (total == 0) {
            progress.set(new BatchProgressVO(
                    "COMPLETED", 0, 0, 0, 0, 0, null, "没有待补题目", List.of()));
            return;
        }

        List<Question> candidates = questionMapper.selectList(buildCandidateWrapper(categoryId, maxQuestions));
        int success = 0;
        int fail = 0;
        int processed = 0;

        for (int i = 0; i < candidates.size(); i++) {
            Question question = candidates.get(i);
            progress.set(new BatchProgressVO(
                    "RUNNING", 0, processed, total, success, fail, currentCategory(question),
                    "正在补答案: " + question.getTitle(), List.copyOf(errors)));

            try {
                AiQuestionService.FillAnswerResult result = aiQuestionService.fillAnswerSync(question);
                if (result.success()) {
                    success++;
                } else {
                    fail++;
                    addError(errors, question.getId() + ": " + result.error());
                }
            } catch (Exception e) {
                fail++;
                addError(errors, question.getId() + ": " + e.getMessage());
                log.warn("批量补答案单题失败: id={}, title='{}', error={}",
                        question.getId(), question.getTitle(), e.getMessage());
            }

            processed++;
            progress.set(new BatchProgressVO(
                    "RUNNING", 0, processed, total, success, fail, currentCategory(question),
                    "已完成 " + processed + "/" + total + " 题", List.copyOf(errors)));
            sleepBeforeNext(delaySeconds, i, candidates.size());
        }

        progress.set(new BatchProgressVO(
                "COMPLETED", 0, processed, total, success, fail, null,
                "批量补答案完成: 成功 " + success + " 题，失败 " + fail + " 题",
                List.copyOf(errors)));
        log.info("批量补答案完成: total={}, success={}, fail={}", total, success, fail);
    }

    private LambdaQueryWrapper<Question> buildCandidateWrapper(Long categoryId, Integer limit) {
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, STATUS_DRAFT)
                .and(w -> w.isNull(Question::getContent).or().eq(Question::getContent, ""))
                .eq(categoryId != null, Question::getCategoryId, categoryId)
                .orderByAsc(Question::getId);
        if (limit != null) {
            wrapper.last("LIMIT " + limit);
        }
        return wrapper;
    }

    private int normalizeTotal(long available, Integer maxQuestions) {
        long total = maxQuestions == null ? available : Math.min(available, maxQuestions);
        return total > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) Math.max(0, total);
    }

    private String currentCategory(Question question) {
        return question.getCategoryId() == null ? null : "分类 " + question.getCategoryId();
    }

    private void addError(List<String> errors, String error) {
        if (errors.size() < MAX_ERROR_RECORDS) {
            errors.add(error);
        }
    }

    private void sleepBeforeNext(int delaySeconds, int index, int total) {
        if (delaySeconds <= 0 || index >= total - 1) {
            return;
        }
        try {
            Thread.sleep(delaySeconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
