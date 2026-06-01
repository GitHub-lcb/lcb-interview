package com.lcbinterview.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * 批量生成任务的进度状态。
 * @author chongan
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BatchProgressVO(
        String status,
        int totalCategories,
        int completedCategories,
        int totalQuestions,
        int generatedQuestions,
        int failedCategories,
        String currentCategory,
        String currentMessage,
        List<String> errors
) {}
