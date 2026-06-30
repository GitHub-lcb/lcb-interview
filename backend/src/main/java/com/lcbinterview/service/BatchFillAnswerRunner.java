package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lcbinterview.dto.BatchProgressVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
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
    private static final int DEFAULT_CONCURRENCY = 3;
    private static final int MAX_CONCURRENCY = 10;

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
        return start(categoryId, maxQuestions, delaySeconds, DEFAULT_CONCURRENCY);
    }

    /**
     * 启动后台批量补答案任务。
     *
     * @param categoryId 分类 ID，可选
     * @param maxQuestions 本次最大处理题数，可选
     * @param delaySeconds 每题处理后的等待秒数
     * @param concurrency 并发补答案请求数，最高 10
     * @return true 表示任务已启动，false 表示已有任务运行中
     */
    public boolean start(Long categoryId, Integer maxQuestions, int delaySeconds, int concurrency) {
        if (!running.compareAndSet(false, true)) {
            log.warn("批量补答案任务已在运行中，拒绝新请求");
            return false;
        }

        int safeDelaySeconds = Math.max(0, delaySeconds);
        int safeConcurrency = normalizeConcurrency(concurrency);
        Integer safeMaxQuestions = maxQuestions == null || maxQuestions <= 0 ? null : maxQuestions;
        progress.set(new BatchProgressVO(
                "RUNNING", 0, 0, 0, 0, 0, null,
                "准备批量补答案，并发 " + safeConcurrency, List.of()));

        executor.submit(() -> {
            try {
                runBatch(categoryId, safeMaxQuestions, safeDelaySeconds, safeConcurrency);
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

    private void runBatch(Long categoryId, Integer maxQuestions, int delaySeconds, int concurrency) {
        long available = questionMapper.selectCount(buildCandidateWrapper(categoryId, null));
        int total = normalizeTotal(available, maxQuestions);
        List<String> errors = Collections.synchronizedList(new ArrayList<>());
        log.info("批量补答案启动: categoryId={}, maxQuestions={}, delay={}s, concurrency={}, 待处理={}题",
                categoryId, maxQuestions, delaySeconds, concurrency, total);

        progress.set(new BatchProgressVO(
                "RUNNING", 0, 0, total, 0, 0, null,
                "加载待补题目，并发 " + concurrency + "...", List.of()));
        if (total == 0) {
            progress.set(new BatchProgressVO(
                    "COMPLETED", 0, 0, 0, 0, 0, null, "没有待补题目", List.of()));
            return;
        }

        List<Question> candidates = questionMapper.selectList(buildCandidateWrapper(categoryId, maxQuestions));
        AtomicInteger success = new AtomicInteger();
        AtomicInteger fail = new AtomicInteger();
        AtomicInteger processed = new AtomicInteger();
        runCandidates(candidates, total, delaySeconds, concurrency, success, fail, processed, errors);

        progress.set(new BatchProgressVO(
                "COMPLETED", 0, processed.get(), total, success.get(), fail.get(), null,
                "批量补答案完成: 成功 " + success.get() + " 题，失败 " + fail.get() + " 题，并发 " + concurrency,
                snapshotErrors(errors)));
        log.info("批量补答案完成: total={}, success={}, fail={}, concurrency={}",
                total, success.get(), fail.get(), concurrency);
    }

    private void runCandidates(
            List<Question> candidates,
            int total,
            int delaySeconds,
            int concurrency,
            AtomicInteger success,
            AtomicInteger fail,
            AtomicInteger processed,
            List<String> errors) {
        int workerCount = Math.max(1, Math.min(concurrency, candidates.size()));
        ExecutorService workerPool = Executors.newFixedThreadPool(workerCount);
        List<Future<?>> futures = new ArrayList<>();
        try {
            for (Question question : candidates) {
                futures.add(workerPool.submit(() ->
                        processQuestion(question, total, delaySeconds, success, fail, processed, errors)));
            }
            for (Future<?> future : futures) {
                waitForWorker(future, errors);
            }
        } finally {
            workerPool.shutdownNow();
        }
    }

    private void processQuestion(
            Question question,
            int total,
            int delaySeconds,
            AtomicInteger success,
            AtomicInteger fail,
            AtomicInteger processed,
            List<String> errors) {
        progress.set(new BatchProgressVO(
                "RUNNING", 0, processed.get(), total, success.get(), fail.get(), currentCategory(question),
                "正在补答案: " + question.getTitle(), snapshotErrors(errors)));

        try {
            AiQuestionService.FillAnswerResult result = aiQuestionService.fillAnswerSync(question);
            if (result.success()) {
                success.incrementAndGet();
            } else {
                fail.incrementAndGet();
                addError(errors, question.getId() + ": " + result.error());
            }
        } catch (Exception e) {
            fail.incrementAndGet();
            addError(errors, question.getId() + ": " + e.getMessage());
            log.warn("批量补答案单题失败: id={}, title='{}', error={}",
                    question.getId(), question.getTitle(), e.getMessage());
        }

        int currentProcessed = processed.incrementAndGet();
        progress.set(new BatchProgressVO(
                "RUNNING", 0, currentProcessed, total, success.get(), fail.get(), currentCategory(question),
                "已完成 " + currentProcessed + "/" + total + " 题", snapshotErrors(errors)));
        sleepBeforeNext(delaySeconds, currentProcessed, total);
    }

    private void waitForWorker(Future<?> future, List<String> errors) {
        try {
            future.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            addError(errors, "批量补答案等待并发任务时被中断");
        } catch (ExecutionException e) {
            addError(errors, "批量补答案并发任务异常: " + e.getCause().getMessage());
        }
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

    private int normalizeConcurrency(int concurrency) {
        return Math.max(1, Math.min(MAX_CONCURRENCY, concurrency));
    }

    private String currentCategory(Question question) {
        return question.getCategoryId() == null ? null : "分类 " + question.getCategoryId();
    }

    private void addError(List<String> errors, String error) {
        synchronized (errors) {
            if (errors.size() < MAX_ERROR_RECORDS) {
                errors.add(error);
            }
        }
    }

    private List<String> snapshotErrors(List<String> errors) {
        synchronized (errors) {
            return List.copyOf(errors);
        }
    }

    private void sleepBeforeNext(int delaySeconds, int processed, int total) {
        if (delaySeconds <= 0 || processed >= total) {
            return;
        }
        try {
            Thread.sleep(delaySeconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
