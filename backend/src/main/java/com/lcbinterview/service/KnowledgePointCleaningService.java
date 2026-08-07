package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 考点清洗管道：分批调用 AI 给题目打考点，建立 分类 → 考点 → 题目 关联，
 * 并顺带补齐无标签题目的标签。新增考点一律 DRAFT 待人工审核。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgePointCleaningService {

    /** 每批题目数量，控制单次 AI 输入长度 */
    private static final int BATCH_SIZE = 20;
    /** 单批 AI 调用失败后的重试次数 */
    private static final int MAX_AI_ATTEMPTS = 3;
    /** 推理模型需预留思考 token，同时保持在题目长答案全局配置的四分之一 */
    private static final int AI_MAX_TOKENS = 16384;
    /** 批量结构化提取读取超时，实测慢请求约 144 秒，保留 180 秒边界 */
    private static final int AI_READ_TIMEOUT_MS = 180000;
    /** 输入每题内容的截断长度，避免批次过大 */
    private static final int CONTENT_TRUNCATE = 300;
    /** 并发工作线程数：AI 调用是 IO 密集，4 路并发把全量清洗从约 40 分钟压到 10 分钟左右 */
    private static final int WORKER_COUNT = 4;

    private final QuestionMapper questionMapper;
    private final CategoryMapper categoryMapper;
    private final KnowledgePointPersistenceService persistenceService;
    private final AiRuntimeConfigService aiRuntimeConfigService;
    private final AiHttpClient aiHttpClient;
    private final ObjectMapper objectMapper;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean shuttingDown = new AtomicBoolean(false);
    private final AtomicReference<ExecutorService> activeWorkers = new AtomicReference<>();
    private final AtomicReference<CleanProgress> progress = new AtomicReference<>(
            new CleanProgress(false, 0, 0, 0, 0, 0, 0, ""));
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "knowledge-point-cleaning");
        thread.setDaemon(true);
        return thread;
    });

    /**
     * 启动考点清洗任务（异步执行）。已有任务运行时拒绝新请求。
     *
     * @return 是否成功启动
     */
    public boolean start() {
        if (shuttingDown.get()) {
            return false;
        }
        if (!running.compareAndSet(false, true)) {
            log.warn("考点清洗任务已在运行中，拒绝新请求");
            return false;
        }
        try {
            executor.submit(() -> {
                try {
                    cleanOnce();
                } catch (Exception e) {
                    log.error("考点清洗任务异常终止", e);
                    CleanProgress previous = progress.get();
                    progress.set(new CleanProgress(false, previous.totalQuestions(),
                            previous.processedQuestions(), previous.newKnowledgePoints(),
                            previous.taggedQuestions(), previous.failedBatches(), previous.totalBatches(),
                            "任务异常终止: " + safeMessage(e)));
                } finally {
                    running.set(false);
                }
            });
            return true;
        } catch (RejectedExecutionException e) {
            running.set(false);
            return false;
        }
    }

    /**
     * 同步执行一次全量考点清洗，供单元测试与可能的同步触发场景使用。
     * 注意：本方法不占用运行锁，异步任务与测试共用同一套进度统计。
     *
     * @return 完成后的进度快照
     */
    public CleanProgress cleanOnce() {
        log.info("===== 考点清洗任务启动 =====");
        Long maxPublishedId = questionMapper.selectMaxPublishedId();
        long maxId = maxPublishedId == null ? 0 : maxPublishedId;
        long total = maxId == 0 ? 0 : questionMapper.countPublishedUpTo(maxId);
        // 分类 id → 名称映射，用于补标签时以分类名兜底
        Map<Long, String> categoryNames = new HashMap<>();
        for (Category category : categoryMapper.selectList(null)) {
            categoryNames.put(category.getId(), category.getName());
        }
        long lastId = 0;
        Counters counters = new Counters();
        int totalBatches = (int) Math.ceil((double) total / BATCH_SIZE);

        progress.set(new CleanProgress(true, total, counters.processed, 0, 0, 0, totalBatches, "准备中..."));

        ExecutorService workers = newWorkerPool();
        if (!activeWorkers.compareAndSet(null, workers)) {
            workers.shutdownNow();
            throw new IllegalStateException("考点清洗 worker 已在运行");
        }
        List<Future<CleaningResult>> futures = new ArrayList<>();
        try {
            // 主线程只负责取批，AI 清洗在工作线程并行执行。
            // 有界提交：排队批数超过 2 倍并发时就收掉最老一批，避免 AI 慢时所有批次
            // 全量排队（每批持有 20 道全字段题目）导致内存峰值。
            while (!shuttingDown.get()) {
                List<Question> batch = questionMapper.selectPublishedBatchAfter(lastId, maxId, BATCH_SIZE);
                if (batch.isEmpty()) {
                    break;
                }
                lastId = batch.get(batch.size() - 1).getId();
                futures.add(workers.submit(() -> {
                    try {
                        return cleanBatch(batch, categoryNames);
                    } catch (CancellationException e) {
                        throw e;
                    } catch (Exception e) {
                        log.error("考点清洗批次失败: {}", safeMessage(e));
                        return CleaningResult.failed(batch.size());
                    }
                }));
                if (futures.size() >= WORKER_COUNT * 2) {
                    collectResult(futures.remove(0), counters, total, totalBatches);
                }
            }
            while (!futures.isEmpty()) {
                collectResult(futures.remove(0), counters, total, totalBatches);
            }
        } finally {
            cancelAndShutdown(workers, futures);
            activeWorkers.compareAndSet(workers, null);
        }

        CleanProgress done = new CleanProgress(false, total, Math.min(counters.processed, total),
                counters.newKnowledgePoints, counters.taggedQuestions, counters.failedBatches, totalBatches,
                "清洗完成：处理 " + Math.min(counters.processed, total) + "/" + total + " 道题，新增考点 "
                        + counters.newKnowledgePoints + " 个，补标签 " + counters.taggedQuestions
                        + " 道，失败批次 " + counters.failedBatches);
        progress.set(done);
        log.info("===== 考点清洗任务完成: 处理 {} 题, 新增考点 {}, 补标签 {} =====",
                counters.processed, counters.newKnowledgePoints, counters.taggedQuestions);
        return done;
    }

    /**
     * 收集单个批次结果并更新进度，失败记入失败批次数。
     *
     * @param future       批次结果
     * @param counters     累计统计容器
     * @param total        总题数
     * @param totalBatches 总批数
     */
    private void collectResult(Future<CleaningResult> future, Counters counters,
                               long total, int totalBatches) {
        try {
            CleaningResult result = future.get();
            counters.processed += result.processedCount();
            counters.newKnowledgePoints += result.newKnowledgePointCount();
            counters.taggedQuestions += result.taggedQuestionCount();
            if (result.failed()) {
                counters.failedBatches += 1;
            }
            progress.set(new CleanProgress(true, total, Math.min(counters.processed, total),
                    counters.newKnowledgePoints, counters.taggedQuestions, counters.failedBatches, totalBatches,
                    "已处理 " + Math.min(counters.processed, total) + "/" + total));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("考点清洗任务被中断", e);
        } catch (Exception e) {
            counters.failedBatches += 1;
            log.error("考点清洗批次结果读取失败: error={}", safeMessage(e));
            progress.set(new CleanProgress(true, total, counters.processed,
                    counters.newKnowledgePoints, counters.taggedQuestions, counters.failedBatches, totalBatches,
                    "批次失败，已处理 " + counters.processed + "/" + total));
        }
    }

    /**
     * 清洗统计容器，跨批次累计。
     */
    private static final class Counters {

        private int processed;
        private int newKnowledgePoints;
        private int taggedQuestions;
        private int failedBatches;
    }

    /**
     * 查询当前清洗进度。
     *
     * @return 清洗进度
     */
    public CleanProgress getProgress() {
        return progress.get();
    }

    /**
     * 应用关闭时停止后台线程，避免阻塞 JVM 退出。
     */
    @PreDestroy
    void shutdownExecutor() {
        shuttingDown.set(true);
        ExecutorService workers = activeWorkers.get();
        if (workers != null) {
            workers.shutdownNow();
        }
        aiHttpClient.disconnectActiveConnections();
        executor.shutdownNow();
    }

    /**
     * 清洗单批题目：AI 提取考点 → 匹配/创建考点 → 写关联 → 补标签。
     *
     * @param batch          一批题目
     * @param categoryNames 分类 id → 名称映射，用于补标签兜底
     * @return 本批统计结果
     */
    private CleaningResult cleanBatch(List<Question> batch, Map<Long, String> categoryNames) throws Exception {
        String prompt = buildPrompt(batch);
        Map<Long, List<String>> pointsByQuestion = callAiWithRetry(prompt,
                batch.stream().map(Question::getId).collect(java.util.stream.Collectors.toSet()));
        ensureNotShuttingDown();
        KnowledgePointPersistenceService.CleaningWriteResult result =
                persistenceService.persistCleaningBatch(batch, pointsByQuestion, categoryNames);
        return new CleaningResult(batch.size(), result.newKnowledgePoints(), result.taggedQuestions(), false);
    }

    private String buildPrompt(List<Question> batch) {
        List<Map<String, String>> items = new ArrayList<>();
        for (Question question : batch) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("questionId", String.valueOf(question.getId()));
            item.put("title", question.getTitle());
            String content = question.getContent() == null ? "" : question.getContent();
            if (content.length() > CONTENT_TRUNCATE) {
                content = content.substring(0, CONTENT_TRUNCATE);
            }
            item.put("content", content);
            items.add(item);
        }
        return """
                你是资深技术面试官。下面是题库中的 %d 道题（JSON 数组，每项含 questionId/title/content）。
                请为每道题给出 1-3 个"考点"（粗粒度知识主题，如：HashMap原理、JVM内存、TCP握手、Vue响应式原理、MySQL索引）。
                 要求：
                 1. 考点是知识主题不是题目原文，同一考点跨题目必须用相同名称。
                 2. 忽略 HR/行为类内容。
                 3. items 必须包含每个输入 questionId 恰好一次；无技术考点返回空数组，不得遗漏题目。
                 4. 只输出 JSON：{"items":[{"questionId":1,"knowledgePoints":["A","B"]}]}
                """.formatted(batch.size()) + "\n" + toJson(items);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("考点清洗输入序列化失败", e);
        }
    }

    private Map<Long, List<String>> callAiWithRetry(String prompt, java.util.Set<Long> expectedIds) {
        AiRuntimeConfig config = aiRuntimeConfigService.current();
        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
            ensureNotShuttingDown();
            try {
                String response = aiHttpClient.callSync(prompt, config, AI_MAX_TOKENS, AI_READ_TIMEOUT_MS);
                JsonNode root = objectMapper.readTree(response);
                String content = root.path("choices").path(0).path("message").path("content").asText("");
                JsonNode extracted = objectMapper.readTree(extractJson(content));
                return parseExtraction(extracted, expectedIds);
            } catch (Exception e) {
                ensureNotShuttingDown();
                lastError = e;
                log.warn("考点提取 AI 调用失败 (第 {} 次): {}", attempt, e.getMessage());
            }
        }
        throw new IllegalStateException("考点提取 AI 调用失败: " + safeMessage(lastError));
    }

    private String extractJson(String content) {
        String clean = content.trim()
                .replaceAll("(?s)^```json\\s*", "")
                .replaceAll("(?s)^```\\s*", "")
                .replaceAll("(?s)\\s*```$", "")
                .trim();
        int start = clean.indexOf('{');
        int end = clean.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("AI 响应中没有 JSON");
        }
        return clean.substring(start, end + 1);
    }

    private Map<Long, List<String>> parseExtraction(JsonNode root, java.util.Set<Long> expectedIds) {
        Map<Long, List<String>> result = new LinkedHashMap<>();
        JsonNode items = root.path("items");
        if (!items.isArray()) {
            throw new IllegalArgumentException("考点提取结果缺少 items 数组");
        }
        for (JsonNode item : items) {
            long questionId = item.path("questionId").asLong(0);
            if (!expectedIds.contains(questionId) || result.containsKey(questionId)) {
                throw new IllegalArgumentException("题目 ID 缺失、重复或不属于当前批次: " + questionId);
            }
            LinkedHashSet<String> names = new LinkedHashSet<>();
            JsonNode points = item.path("knowledgePoints");
            if (!points.isArray()) {
                throw new IllegalArgumentException("knowledgePoints 必须是数组: " + questionId);
            }
            if (points.size() > 3) {
                throw new IllegalArgumentException("每道题最多返回 3 个考点: " + questionId);
            }
            for (JsonNode point : points) {
                names.add(KnowledgePointPersistenceService.normalizeName(point.asText("")));
            }
            result.put(questionId, names.stream().toList());
        }
        if (!result.keySet().equals(expectedIds)) {
            throw new IllegalArgumentException("AI 返回题目数量与当前批次不一致");
        }
        return result;
    }

    private ExecutorService newWorkerPool() {
        return Executors.newFixedThreadPool(WORKER_COUNT, runnable -> {
            Thread thread = new Thread(runnable, "knowledge-point-cleaning-worker");
            thread.setDaemon(true);
            return thread;
        });
    }

    private void cancelAndShutdown(ExecutorService workers, List<? extends Future<?>> futures) {
        if (shuttingDown.get()) {
            futures.forEach(future -> future.cancel(true));
            workers.shutdownNow();
        } else {
            workers.shutdown();
        }
        try {
            if (!workers.awaitTermination(5, TimeUnit.SECONDS)) {
                futures.forEach(future -> future.cancel(true));
                workers.shutdownNow();
            }
        } catch (InterruptedException e) {
            futures.forEach(future -> future.cancel(true));
            workers.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    private static String safeMessage(Throwable error) {
        return error == null || error.getMessage() == null ? "未知错误" : error.getMessage();
    }

    private void ensureNotShuttingDown() {
        if (shuttingDown.get() || Thread.currentThread().isInterrupted()) {
            throw new CancellationException("考点清洗任务正在关闭");
        }
    }

    /**
     * 单批清洗结果。
     *
     * @param processedCount         本批实际处理题目数
     * @param newKnowledgePointCount 本批新增考点数
     * @param taggedQuestionCount    本批补标签题目数
     * @param failed                 本批是否失败
     */
    private record CleaningResult(int processedCount, int newKnowledgePointCount,
                                  int taggedQuestionCount, boolean failed) {

        private static CleaningResult failed(int processedCount) {
            return new CleaningResult(processedCount, 0, 0, true);
        }
    }

    /**
     * 清洗进度。
     *
     * @param running            是否运行中
     * @param totalQuestions     待清洗题目总数
     * @param processedQuestions 已处理题目数
     * @param newKnowledgePoints 新增考点数
     * @param taggedQuestions    补标签题目数
     * @param failedBatches      失败批次
     * @param totalBatches       本轮总批次
     * @param message            状态消息
     */
    public record CleanProgress(
            boolean running,
            long totalQuestions,
            long processedQuestions,
            int newKnowledgePoints,
            int taggedQuestions,
            int failedBatches,
            int totalBatches,
            String message
    ) {
    }
}
