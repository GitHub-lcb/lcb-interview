package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.service.AiQuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AI 题目生成接口。
 * @author chongan
 */
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiGenerationController {

    private final AiQuestionService aiQuestionService;

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
}
