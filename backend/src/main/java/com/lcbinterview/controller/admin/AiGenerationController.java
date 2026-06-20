package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.BatchGenerationRequest;
import com.lcbinterview.dto.BatchProgressVO;
import com.lcbinterview.dto.FillAnswersRequest;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.service.AiGenerationRequestPolicy;
import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.BatchGenerationRunner;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AI 题目生成接口。所有 AI 操作均通过 SSE 流式推送进度和思考过程。
 * @author chongan
 */
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiGenerationController {

    private static final long SSE_TIMEOUT_NEVER = 0L;

    private final AiQuestionService aiQuestionService;
    private final BatchGenerationRunner batchRunner;
    private final AiGenerationRequestPolicy requestPolicy;

    /**
     * SSE 流式生成单道题。实时推送 AI 思考过程（reasoning_content）和内容。
     * 前端使用 EventSource 连接：
     *   es.addEventListener('thinking', e => console.log(e.data))
     *   es.addEventListener('content', e => console.log(e.data))
     *   es.addEventListener('progress', e => { JSON.parse(e.data) })
     *   es.addEventListener('question_result', e => { JSON.parse(e.data) })
     *   es.addEventListener('done', e => { es.close() })
     */
    @GetMapping(value = "/generate-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter generateStream(
            @RequestParam String category,
            @RequestParam(required = false) String difficulty,
            @RequestParam(defaultValue = "1") int count,
            @RequestParam(required = false) String topic) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_NEVER);
        GenerationRequest req = new GenerationRequest(category, difficulty, requestPolicy.clampCount(count), topic);
        aiQuestionService.streamGenerate(req, emitter);
        return emitter;
    }

    /**
     * SSE 流式补答案。逐题发送，实时推送 AI 思考过程和补全内容。
     */
    @GetMapping(value = "/fill-answer-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter fillAnswerStream(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "5") int count) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_NEVER);
        aiQuestionService.streamFillAnswer(categoryId, requestPolicy.clampCount(count), emitter);
        return emitter;
    }

    /**
     * 批量生成所有分类的题目。异步执行，通过日志和 /batch/status 查看进度。
     */
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<String>> batchGenerate(@Valid @RequestBody BatchGenerationRequest req) {
        boolean started = batchRunner.start(
                req.countPerCategory(), req.categoryName(), req.delaySeconds());
        if (!started) {
            return ResponseEntity.ok(ApiResponse.error(409, "批量任务已在运行中"));
        }
        return ResponseEntity.ok(ApiResponse.success("批量生成任务已启动"));
    }

    /**
     * 查询批量任务进度。
     */
    @GetMapping("/batch/status")
    public ResponseEntity<ApiResponse<BatchProgressVO>> batchStatus() {
        return ResponseEntity.ok(ApiResponse.success(batchRunner.getProgress()));
    }
}
