package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.AdminAiConfigStatusVO;
import com.lcbinterview.dto.AdminAiConfigUpdateRequest;
import com.lcbinterview.dto.AdminAiConfigVO;
import com.lcbinterview.dto.BatchFillAnswerRequest;
import com.lcbinterview.dto.BatchGenerationRequest;
import com.lcbinterview.dto.BatchProgressVO;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.service.AiGenerationRequestPolicy;
import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.AiRuntimeConfigService;
import com.lcbinterview.service.BatchFillAnswerRunner;
import com.lcbinterview.service.BatchGenerationRunner;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "管理端 AI 生成")
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiGenerationController {

    private static final long SSE_TIMEOUT_NEVER = 0L;

    private final AiQuestionService aiQuestionService;
    private final BatchGenerationRunner batchRunner;
    private final BatchFillAnswerRunner batchFillAnswerRunner;
    private final AiGenerationRequestPolicy requestPolicy;
    private final AiRuntimeConfigService aiRuntimeConfigService;

    /**
     * 查询 AI 生成服务配置状态，供管理端展示可用性和非敏感诊断信息。
     *
     * @return AI 配置状态
     */
    @Operation(summary = "查询 AI 配置状态")
    @GetMapping("/config-status")
    public ResponseEntity<ApiResponse<AdminAiConfigStatusVO>> configStatus() {
        return ResponseEntity.ok(ApiResponse.success(aiQuestionService.configStatus()));
    }

    /**
     * 查询 AI 运行时配置，密钥只返回脱敏结果。
     *
     * @return AI 运行时配置
     */
    @Operation(summary = "查询 AI 运行时配置")
    @GetMapping("/config")
    public ResponseEntity<ApiResponse<AdminAiConfigVO>> config() {
        return ResponseEntity.ok(ApiResponse.success(aiRuntimeConfigService.publicConfig()));
    }

    /**
     * 保存 AI 运行时配置，apiKey 为空时保留已有数据库密钥。
     *
     * @param request AI 配置更新请求
     * @return 保存后的 AI 运行时配置
     */
    @Operation(summary = "更新 AI 运行时配置")
    @PutMapping("/config")
    public ResponseEntity<ApiResponse<AdminAiConfigVO>> updateConfig(
            @Valid @RequestBody AdminAiConfigUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(aiRuntimeConfigService.save(request)));
    }

    /**
     * SSE 流式生成单道题。实时推送 AI 思考过程（reasoning_content）和内容。
     * 前端使用 EventSource 连接：
     *   es.addEventListener('thinking', e => console.log(e.data))
     *   es.addEventListener('content', e => console.log(e.data))
     *   es.addEventListener('progress', e => { JSON.parse(e.data) })
     *   es.addEventListener('question_result', e => { JSON.parse(e.data) })
     *   es.addEventListener('done', e => { es.close() })
     */
    @Operation(summary = "SSE 方式生成题目答案")
    @GetMapping(value = "/generate-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter generateStream(
            @RequestParam String category,
            @RequestParam(required = false) String difficulty,
            @RequestParam(defaultValue = "1") int count,
            @RequestParam(required = false) String topic) {
        AdminAiConfigStatusVO configStatus = aiQuestionService.configStatus();
        if (!configStatus.available()) {
            return unavailableStream(configStatus);
        }
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_NEVER);
        GenerationRequest req = new GenerationRequest(category, difficulty, requestPolicy.clampCount(count), topic);
        aiQuestionService.streamGenerate(req, emitter);
        return emitter;
    }

    /**
     * SSE 流式补答案。逐题发送，实时推送 AI 思考过程和补全内容。
     */
    @Operation(summary = "SSE 方式补齐答案字段")
    @GetMapping(value = "/fill-answer-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter fillAnswerStream(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "5") int count) {
        AdminAiConfigStatusVO configStatus = aiQuestionService.configStatus();
        if (!configStatus.available()) {
            return unavailableStream(configStatus);
        }
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_NEVER);
        aiQuestionService.streamFillAnswer(categoryId, requestPolicy.clampCount(count), emitter);
        return emitter;
    }

    /**
     * SSE 流式重写已发布题目答案。生成结果进入草稿审核，不直接覆盖线上答案。
     */
    @Operation(summary = "SSE 方式重写已发布题目答案")
    @GetMapping(value = "/rewrite-published-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter rewritePublishedStream(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "5") int count) {
        AdminAiConfigStatusVO configStatus = aiQuestionService.configStatus();
        if (!configStatus.available()) {
            return unavailableStream(configStatus);
        }
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_NEVER);
        aiQuestionService.streamRewritePublishedAnswers(categoryId, keyword, requestPolicy.clampCount(count), emitter);
        return emitter;
    }

    /**
     * 批量生成所有分类的题目。异步执行，通过日志和 /batch/status 查看进度。
     */
    @Operation(summary = "启动批量生成任务")
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<String>> batchGenerate(@Valid @RequestBody BatchGenerationRequest req) {
        AdminAiConfigStatusVO configStatus = aiQuestionService.configStatus();
        if (!configStatus.available()) {
            return ResponseEntity.ok(ApiResponse.error(503, configStatus.message()));
        }
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
    @Operation(summary = "查询批量生成进度")
    @GetMapping("/batch/status")
    public ResponseEntity<ApiResponse<BatchProgressVO>> batchStatus() {
        return ResponseEntity.ok(ApiResponse.success(batchRunner.getProgress()));
    }

    /**
     * 后台批量补答案。异步处理待补草稿，通过 /fill-answer-batch/status 查看进度。
     *
     * @param req 批量补答案请求
     * @return 启动结果
     */
    @Operation(summary = "启动批量补答案任务")
    @PostMapping("/fill-answer-batch")
    public ResponseEntity<ApiResponse<String>> batchFillAnswers(@Valid @RequestBody BatchFillAnswerRequest req) {
        AdminAiConfigStatusVO configStatus = aiQuestionService.configStatus();
        if (!configStatus.available()) {
            return ResponseEntity.ok(ApiResponse.error(503, configStatus.message()));
        }
        boolean started = batchFillAnswerRunner.start(
                req.categoryId(), req.maxQuestions(), req.delaySeconds(), req.concurrency());
        if (!started) {
            return ResponseEntity.ok(ApiResponse.error(409, "批量补答案任务已在运行中"));
        }
        return ResponseEntity.ok(ApiResponse.success("批量补答案任务已启动"));
    }

    /**
     * 查询后台批量补答案任务进度。
     *
     * @return 当前任务进度
     */
    @Operation(summary = "查询批量补答案进度")
    @GetMapping("/fill-answer-batch/status")
    public ResponseEntity<ApiResponse<BatchProgressVO>> batchFillAnswerStatus() {
        return ResponseEntity.ok(ApiResponse.success(batchFillAnswerRunner.getProgress()));
    }

    private SseEmitter unavailableStream(AdminAiConfigStatusVO configStatus) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_NEVER);
        try {
            emitter.send(SseEmitter.event().name("error").data(configStatus.message()));
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
        return emitter;
    }
}
