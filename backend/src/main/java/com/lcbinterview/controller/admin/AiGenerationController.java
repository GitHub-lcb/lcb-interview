package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.BatchGenerationRequest;
import com.lcbinterview.dto.BatchProgressVO;
import com.lcbinterview.dto.FillAnswersRequest;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.BatchGenerationRunner;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AI 题目生成接口。
 * @author chongan
 */
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiGenerationController {

    private final AiQuestionService aiQuestionService;
    private final BatchGenerationRunner batchRunner;

    /**
     * 触发生成任务。
     */
    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<Long>> generate(@Valid @RequestBody GenerationRequest req) {
        Long taskId = aiQuestionService.generate(req);
        return ResponseEntity.ok(ApiResponse.success(taskId));
    }

    /**
     * 查询生成任务状态。
     */
    @GetMapping("/tasks/{id}")
    public ResponseEntity<ApiResponse<GenerationTaskVO>> getTask(@PathVariable Long id) {
        GenerationTaskVO task = aiQuestionService.getTask(id);
        if (task == null) {
            return ResponseEntity.ok(ApiResponse.error(404, "任务不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success(task));
    }

    /**
     * 批量生成所有分类的题目。异步执行，通过日志查看进度。
     */
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<String>> batchGenerate(@Valid @RequestBody BatchGenerationRequest req) {
        boolean started = batchRunner.start(
                req.countPerCategory(), req.categoryName(), req.delaySeconds());
        if (!started) {
            return ResponseEntity.ok(ApiResponse.error(409, "批量任务已在运行中"));
        }
        return ResponseEntity.ok(ApiResponse.success("批量生成任务已启动，请查看后端日志跟踪进度"));
    }

    /**
     * 查询批量任务进度。
     */
    @GetMapping("/batch/status")
    public ResponseEntity<ApiResponse<BatchProgressVO>> batchStatus() {
        return ResponseEntity.ok(ApiResponse.success(batchRunner.getProgress()));
    }

    /**
     * 为已有 DRAFT 草稿题补全答案。按分类读取 content 为空的草稿，调用 AI 生成答案。
     */
    @PostMapping("/fill-answers")
    public ResponseEntity<ApiResponse<Long>> fillAnswers(@Valid @RequestBody FillAnswersRequest req) {
        Long taskId = aiQuestionService.fillAnswers(req.categoryId(), req.count());
        return ResponseEntity.ok(ApiResponse.success(taskId));
    }
}
