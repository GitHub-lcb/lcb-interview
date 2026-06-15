package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import com.lcbinterview.service.InterviewCoachService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 面试训练评分接口，为前端模拟面试页提供评分和追问能力。
 */
@Slf4j
@Tag(name = "面试训练")
@RestController
@RequestMapping("/api/interview")
@RequiredArgsConstructor
public class InterviewCoachController {

    private final InterviewCoachService interviewCoachService;

    /**
     * 根据题目上下文和用户回答生成面试评分。
     *
     * @param request 评分请求
     * @return 评分结果
     */
    @Operation(summary = "生成面试训练评分")
    @PostMapping("/evaluate")
    public ResponseEntity<ApiResponse<InterviewFeedbackVO>> evaluate(
            @Valid @RequestBody InterviewEvaluateRequest request) {
        InterviewFeedbackVO feedback = interviewCoachService.evaluate(request);
        log.info("面试评分完成: question={}, score={}, source={}",
                request.questionTitle(), feedback.score(), feedback.source());
        return ResponseEntity.ok(ApiResponse.success(feedback));
    }
}
