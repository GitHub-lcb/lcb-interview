package com.lcbinterview.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.InterviewSourceMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.InterviewSource;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.CancellationException;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 面经语料管道：导入面经条目 → AI 提取考点 → 写入考点提及统计，
 * 为高频权重提供语料频次数据。语料原文仅用于统计，不对外展示。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgePointCorpusService {

    /** 单批面经数量 */
    private static final int BATCH_SIZE = 10;
    /** AI 调用失败重试次数 */
    private static final int MAX_AI_ATTEMPTS = 3;
    /** 语料批次包含 10 篇且推理模型会消耗思考 token，保留足够空间输出完整 JSON */
    private static final int AI_MAX_TOKENS = 16384;
    /** 批量结构化提取读取超时，实测慢请求约 144 秒，保留 180 秒边界 */
    private static final int AI_READ_TIMEOUT_MS = 180000;
    /** 面经输入截断长度，首屏信息在开头 */
    private static final int CONTENT_TRUNCATE = 4000;
    /** 并发工作线程数 */
    private static final int WORKER_COUNT = 4;
    /** 单次导入最大条数，限制 JSON 反序列化后的常驻对象数量 */
    static final int MAX_IMPORT_ITEMS = 100;
    /** 单条语料最大字符数 */
    static final int MAX_RAW_CONTENT_LENGTH = 20000;

    private final InterviewSourceMapper interviewSourceMapper;
    private final CategoryMapper categoryMapper;
    private final KnowledgePointPersistenceService persistenceService;
    private final AiRuntimeConfigService aiRuntimeConfigService;
    private final AiHttpClient aiHttpClient;
    private final ObjectMapper objectMapper;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean shuttingDown = new AtomicBoolean(false);
    private final AtomicReference<ExecutorService> activeWorkers = new AtomicReference<>();
    private final AtomicReference<ExtractProgress> progress = new AtomicReference<>(
            new ExtractProgress(false, 0, 0, 0, 0, ""));
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "knowledge-point-corpus");
        thread.setDaemon(true);
        return thread;
    });

    /**
     * 批量导入面经条目，去重后写入语料表（RAW 状态）。
     *
     * @param items 面经条目
     * @return 新增条数
     */
    @Transactional
    public int importItems(List<CorpusItem> items) {
        validateImportItems(items);
        int inserted = 0;
        for (CorpusItem item : items) {
            InterviewSource source = new InterviewSource();
            source.setSourceUrl(item.sourceUrl().trim());
            source.setSourceName(safeText(item.sourceName()));
            source.setCompany(safeText(item.company()));
            source.setPosition(safeText(item.position()));
            source.setPublishDate(item.publishDate());
            source.setRawContent(item.rawContent());
            inserted += interviewSourceMapper.insertIgnore(source);
        }
        log.info("面经语料导入完成: 新增 {} 条", inserted);
        return inserted;
    }

    /**
     * 启动语料考点提取任务（异步）。已有任务运行时拒绝新请求。
     *
     * @return 是否成功启动
     */
    public boolean startExtract() {
        if (shuttingDown.get()) {
            return false;
        }
        if (!running.compareAndSet(false, true)) {
            log.warn("语料提取任务已在运行中，拒绝新请求");
            return false;
        }
        try {
            executor.submit(() -> {
                try {
                    extractOnce();
                } catch (Exception e) {
                    log.error("语料提取任务异常终止", e);
                    ExtractProgress previous = progress.get();
                    progress.set(new ExtractProgress(false, previous.totalSources(),
                            previous.processedSources(), previous.newMentions(), previous.failedBatches(),
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
     * 查询提取进度。
     *
     * @return 提取进度
     */
    public ExtractProgress getProgress() {
        return progress.get();
    }

    /**
     * 应用关闭时停止后台线程。
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
     * 同步执行一次语料考点提取，供单元测试使用。
     *
     * @return 完成后的进度快照
     */
    public ExtractProgress extractOnce() {
        Long maxPendingId = interviewSourceMapper.selectMaxPendingId();
        long maxId = maxPendingId == null ? 0 : maxPendingId;
        long total = maxId == 0 ? 0 : interviewSourceMapper.countPendingUpTo(maxId);
        progress.set(new ExtractProgress(true, total, 0, 0, 0, "准备中..."));

        Counters counters = new Counters();
        List<Category> categories = categoryMapper.selectList(null);
        Map<Long, String> categoryNames = new LinkedHashMap<>();
        for (Category category : categories) {
            categoryNames.put(category.getId(), category.getName());
        }
        if (total > 0 && categoryNames.isEmpty()) {
            throw new IllegalStateException("题库分类为空，无法归类语料考点");
        }

        // 用 ID 游标而非 OFFSET：工作线程会把行标记为 EXTRACTED，OFFSET 在并发更新下会跳过 RAW 行。
        // 有界提交：排队批数超过 2 倍并发时就收掉最老一批，避免 AI 慢时批次全量排队。
        ExecutorService workers = newWorkerPool();
        if (!activeWorkers.compareAndSet(null, workers)) {
            workers.shutdownNow();
            throw new IllegalStateException("语料提取 worker 已在运行");
        }
        List<Future<BatchResult>> futures = new ArrayList<>();
        long lastId = 0;
        try {
            while (!shuttingDown.get()) {
                List<InterviewSource> batch = interviewSourceMapper.selectPendingBatchAfter(lastId, maxId, BATCH_SIZE);
                if (batch.isEmpty()) {
                    break;
                }
                long batchLastId = batch.get(batch.size() - 1).getId();
                lastId = batchLastId;
                // 失败标记在 worker 内完成，主循环只负责统计
                futures.add(workers.submit(() -> {
                    try {
                        return extractBatch(batch, categoryNames);
                    } catch (CancellationException e) {
                        throw e;
                    } catch (Exception e) {
                        log.error("语料提取批次失败: lastId={}, error={}", batchLastId, safeMessage(e));
                        persistenceService.markCorpusBatchFailed(batch, safeMessage(e));
                        return BatchResult.failed(batch.size());
                    }
                }));
                if (futures.size() >= WORKER_COUNT * 2) {
                    collectBatchResult(futures.remove(0), counters, total);
                }
            }
            while (!futures.isEmpty()) {
                collectBatchResult(futures.remove(0), counters, total);
            }
        } finally {
            cancelAndShutdown(workers, futures);
            activeWorkers.compareAndSet(workers, null);
        }

        ExtractProgress done = new ExtractProgress(false, total, Math.min(counters.processed, total),
                counters.extractedPoints, counters.failedBatches,
                "提取完成：处理 " + Math.min(counters.processed, total) + "/" + total + " 条语料，写入考点提及 "
                        + counters.extractedPoints + " 条，失败批次 " + counters.failedBatches);
        progress.set(done);
        return done;
    }

    /**
     * 收集单批提取结果并更新进度。
     *
     * @param future   批次结果
     * @param counters 累计统计容器
     * @param total    总语料数
     */
    private void collectBatchResult(Future<BatchResult> future, Counters counters, long total) {
        try {
            BatchResult result = future.get();
            counters.processed += result.processedCount();
            if (result.failed()) {
                counters.failedBatches += 1;
            } else {
                counters.extractedPoints += result.newMentionCount();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("语料提取任务被中断", e);
        } catch (Exception e) {
            counters.failedBatches += 1;
            log.error("语料提取批次结果读取失败: {}", e.getMessage());
        }
        progress.set(new ExtractProgress(true, total, Math.min(counters.processed, total),
                counters.extractedPoints, counters.failedBatches,
                "已处理 " + Math.min(counters.processed, total) + "/" + total));
    }

    /**
     * 提取统计容器，跨批次累计。
     */
    private static final class Counters {

        private long processed;
        private int extractedPoints;
        private int failedBatches;
    }

    private BatchResult extractBatch(List<InterviewSource> batch, Map<Long, String> categoryNames) {
        String prompt = buildPrompt(batch, categoryNames);
        Set<Long> expectedIds = batch.stream().map(InterviewSource::getId)
                .collect(java.util.stream.Collectors.toSet());
        List<KnowledgePointPersistenceService.CorpusSourceWrite> extractions =
                callAiWithRetry(prompt, expectedIds, categoryNames.keySet());
        ensureNotShuttingDown();
        KnowledgePointPersistenceService.CorpusWriteResult result =
                persistenceService.persistCorpusBatch(batch, extractions);
        return new BatchResult(batch.size(), result.newMentions(), false);
    }

    private String buildPrompt(List<InterviewSource> batch, Map<Long, String> categoryNames) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (InterviewSource source : batch) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("sourceId", source.getId());
            String content = source.getRawContent() == null ? "" : source.getRawContent();
            if (content.length() > CONTENT_TRUNCATE) {
                content = content.substring(0, CONTENT_TRUNCATE);
            }
            item.put("content", content);
            items.add(item);
        }
        return """
                你是资深技术面试官。下面是 %d 篇中文面经（JSON 数组，每项含 sourceId/content）。
                请从每篇面经中提取"面试官提问/被考察"的技术考点，并给出每个考点在该篇中被问到的次数。
                要求：
                1. 考点是粗粒度的知识主题（如 HashMap原理、JVM内存、TCP三次握手、Vue响应式、MySQL索引），不是题目原文。
                 2. 同一考点在不同篇目必须用相同名称。
                 3. 忽略行为/HR 类内容（自我介绍、项目经历、薪资等）。
                 4. 每篇提取 1-8 个考点，无技术考点返回空数组。
                 5. 每个考点必须选择下面分类列表中的一个 categoryId，不得返回 0 或列表外 ID。
                 6. items 必须包含每个输入 sourceId 恰好一次，不得遗漏、重复或增加其他 ID。
                 只输出 JSON：{"items":[{"sourceId":1,"company":"公司","position":"岗位","knowledgePoints":[{"categoryId":1,"name":"考点名","mentionCount":1,"context":"提问上下文"}]}]}
                 """.formatted(batch.size()) + "\n分类列表：" + toJson(categoryNames) + "\n语料：" + toJson(items);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("语料提取输入序列化失败", e);
        }
    }

    private List<KnowledgePointPersistenceService.CorpusSourceWrite> callAiWithRetry(
            String prompt, Set<Long> expectedIds, Set<Long> validCategoryIds) {
        AiRuntimeConfig config = aiRuntimeConfigService.current();
        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
            ensureNotShuttingDown();
            try {
                String response = aiHttpClient.callSync(prompt, config, AI_MAX_TOKENS, AI_READ_TIMEOUT_MS);
                JsonNode root = objectMapper.readTree(response);
                String content = root.path("choices").path(0).path("message").path("content").asText("");
                JsonNode extracted = objectMapper.readTree(extractJson(content));
                return parseExtraction(extracted, expectedIds, validCategoryIds);
            } catch (Exception e) {
                ensureNotShuttingDown();
                lastError = e;
                log.warn("语料考点提取 AI 调用失败 (第 {} 次): {}", attempt, e.getMessage());
            }
        }
        throw new IllegalStateException("语料考点提取 AI 调用失败: " + safeMessage(lastError));
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

    private List<KnowledgePointPersistenceService.CorpusSourceWrite> parseExtraction(
            JsonNode root, Set<Long> expectedIds, Set<Long> validCategoryIds) {
        List<KnowledgePointPersistenceService.CorpusSourceWrite> results = new ArrayList<>();
        Set<Long> seenSourceIds = new LinkedHashSet<>();
        JsonNode items = root.path("items");
        if (!items.isArray()) {
            throw new IllegalArgumentException("提取结果缺少 items 数组");
        }
        for (JsonNode item : items) {
            long sourceId = item.path("sourceId").asLong(0);
            if (!expectedIds.contains(sourceId) || !seenSourceIds.add(sourceId)) {
                throw new IllegalArgumentException("语料 ID 缺失、重复或不属于当前批次: " + sourceId);
            }
            JsonNode points = item.path("knowledgePoints");
            if (!points.isArray()) {
                throw new IllegalArgumentException("knowledgePoints 必须是数组: " + sourceId);
            }
            if (points.size() > 8) {
                throw new IllegalArgumentException("每篇语料最多返回 8 个考点: " + sourceId);
            }
            List<KnowledgePointPersistenceService.CorpusMentionWrite> mentions = new ArrayList<>();
            Set<String> pointKeys = new LinkedHashSet<>();
            for (JsonNode point : points) {
                long categoryId = point.path("categoryId").asLong(0);
                if (!validCategoryIds.contains(categoryId)) {
                    throw new IllegalArgumentException("考点分类不在题库分类中: " + categoryId);
                }
                String name = KnowledgePointPersistenceService.normalizeName(point.path("name").asText(""));
                if (!pointKeys.add(categoryId + ":" + name)) {
                    throw new IllegalArgumentException("同篇语料重复考点: " + categoryId + ":" + name);
                }
                int count = point.path("mentionCount").asInt(0);
                if (count < 1 || count > 20) {
                    throw new IllegalArgumentException("考点提及次数必须为 1-20: " + count);
                }
                String context = point.path("context").asText("");
                mentions.add(new KnowledgePointPersistenceService.CorpusMentionWrite(categoryId, name, count,
                        truncate(context, 500)));
            }
            results.add(new KnowledgePointPersistenceService.CorpusSourceWrite(sourceId,
                    truncate(item.path("company").asText(""), 80),
                    truncate(item.path("position").asText(""), 80), mentions));
        }
        if (!seenSourceIds.equals(expectedIds)) {
            throw new IllegalArgumentException("AI 返回语料数量与当前批次不一致");
        }
        return results;
    }

    private void validateImportItems(List<CorpusItem> items) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException(400, "语料条目不能为空");
        }
        if (items.size() > MAX_IMPORT_ITEMS) {
            throw new BusinessException(400, "单次最多导入 " + MAX_IMPORT_ITEMS + " 条语料");
        }
        for (CorpusItem item : items) {
            if (item == null || item.sourceUrl() == null || item.sourceUrl().isBlank()) {
                throw new BusinessException(400, "原文地址不能为空");
            }
            validateLength("原文地址", item.sourceUrl(), 500);
            validateLength("来源站点", item.sourceName(), 80);
            validateLength("公司", item.company(), 80);
            validateLength("岗位", item.position(), 80);
            if (item.rawContent() == null || item.rawContent().isBlank()) {
                throw new BusinessException(400, "原文内容不能为空");
            }
            validateLength("原文内容", item.rawContent(), MAX_RAW_CONTENT_LENGTH);
        }
    }

    private void validateLength(String field, String value, int maxLength) {
        if (value != null && value.length() > maxLength) {
            throw new BusinessException(400, field + "不能超过 " + maxLength + " 个字符");
        }
    }

    private ExecutorService newWorkerPool() {
        return Executors.newFixedThreadPool(WORKER_COUNT, runnable -> {
            Thread thread = new Thread(runnable, "knowledge-point-corpus-worker");
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
            throw new CancellationException("语料提取任务正在关闭");
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private static String truncate(String value, int maxLength) {
        String safe = value == null ? "" : value.trim();
        return safe.length() <= maxLength ? safe : safe.substring(0, maxLength);
    }

    /**
     * 单批提取结果。
     *
     * @param processedCount  本批实际处理语料数
     * @param newMentionCount 新增考点提及数
     * @param failed          本批是否失败
     */
    private record BatchResult(int processedCount, int newMentionCount, boolean failed) {

        private static BatchResult failed(int processedCount) {
            return new BatchResult(processedCount, 0, true);
        }
    }

    /**
     * 提取进度。
     *
     * @param running         是否运行中
     * @param totalSources    待提取语料数
     * @param processedSources 已处理语料数
     * @param newMentions     新增考点提及数
     * @param failedBatches   失败批次
     * @param message         状态消息
     */
    public record ExtractProgress(
            boolean running,
            long totalSources,
            long processedSources,
            int newMentions,
            int failedBatches,
            String message
    ) {
    }

    /**
     * 面经导入条目。
     *
     * @param sourceUrl   原文地址
     * @param sourceName  来源站点
     * @param company     公司
     * @param position    岗位
     * @param publishDate 发布日期
     * @param rawContent  原文内容
     */
    public record CorpusItem(
            String sourceUrl,
            String sourceName,
            String company,
            String position,
            LocalDate publishDate,
            String rawContent
    ) {
    }
}
