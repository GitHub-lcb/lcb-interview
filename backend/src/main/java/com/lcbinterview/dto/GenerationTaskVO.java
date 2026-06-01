package com.lcbinterview.dto;

import java.util.List;

/**
 * AI 生成任务状态视图对象。
 * @author chongan
 */
public record GenerationTaskVO(
        Long taskId,
        String status,    // RUNNING / COMPLETED / FAILED / PARTIAL
        int total,
        int successCount,
        int failCount,
        String message,
        List<String> errors,
        List<Long> generatedIds
) {}
