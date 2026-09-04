package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewEvaluateResultVO;
import com.lcbinterview.dto.InterviewFeedbackVO;
import com.lcbinterview.service.InterviewCoachService;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import com.lcbinterview.service.QuotaService;
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
 * 需登录访问：配额必须挂在用户维度；仅 AI 评分计费，规则降级评分免费不限量。
 */
@Slf4j
@Tag(name = "面试训练")
@RestController
@RequestMapping("/api/interview")
@RequiredArgsConstructor
public class InterviewCoachController {

    private static final String RULE_BASED_SOURCE = "RULE_BASED";

    private final InterviewCoachService interviewCoachService;
    private final QuotaService quotaService;

    /**
     * 根据题目上下文和用户回答生成面试评分。
     * AI 评分前预检配额，额度耗尽时快速失败，避免白白消耗模型调用；
     * 仅当实际返回 AI 评分时才消耗配额或积分。
     *
     * @param request 评分请求
     * @return 评分结果和今日剩余 AI 评分次数
     */
    @Operation(summary = "生成面试训练评分")
    @PostMapping("/evaluate")
    public ResponseEntity<ApiResponse<InterviewEvaluateResultVO>> evaluate(
            @Valid @RequestBody InterviewEvaluateRequest request) {
        Long userId = AuthUserContext.currentUserId();
        quotaService.ensureAvailable(userId, Resource.AI_EVALUATE);
        InterviewFeedbackVO feedback = interviewCoachService.evaluate(request);
        if (!RULE_BASED_SOURCE.equals(feedback.source())) {
            quotaService.consume(userId, Resource.AI_EVALUATE);
        }
        int remaining = quotaService.remainingOfDay(userId, Resource.AI_EVALUATE);
        log.info("面试评分完成: question={}, score={}, source={}, remaining={}",
                request.questionTitle(), feedback.score(), feedback.source(), remaining);
        return ResponseEntity.ok(ApiResponse.success(new InterviewEvaluateResultVO(feedback, remaining)));
    }
}
