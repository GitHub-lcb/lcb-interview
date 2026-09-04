package com.lcbinterview.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.InterviewCriterionVO;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import com.lcbinterview.service.InterviewCoachService;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import com.lcbinterview.service.QuotaService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lcbinterview.common.BusinessException;

/**
 * 面试训练评分接口测试，验证配额计费和前端调用依赖的响应格式。
 */
@WebMvcTest(InterviewCoachController.class)
class InterviewCoachControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private InterviewCoachService interviewCoachService;

    @MockBean
    private QuotaService quotaService;

    @BeforeEach
    void setUp() {
        AuthUserContext.setUserId(1L);
    }

    @AfterEach
    void tearDown() {
        AuthUserContext.clear();
    }

    @Test
    void evaluateReturnsUnifiedApiResponse() throws Exception {
        when(interviewCoachService.evaluate(any(InterviewEvaluateRequest.class)))
                .thenReturn(ruleBasedFeedback());
        when(quotaService.remainingOfDay(eq(1L), eq(Resource.AI_EVALUATE))).thenReturn(3);

        mockMvc.perform(post("/api/interview/evaluate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)))
                .andExpect(jsonPath("$.data.feedback.score", is(88)))
                .andExpect(jsonPath("$.data.feedback.source", is("RULE_BASED")))
                .andExpect(jsonPath("$.data.remainingToday", is(3)));

        // 规则评分免费不限量，不应消耗配额
        verify(quotaService, never()).consume(any(), any());
    }

    @Test
    void aiFeedbackConsumesQuota() throws Exception {
        InterviewFeedbackVO aiFeedback = new InterviewFeedbackVO(
                80, "strong", List.of(), List.of(), List.of(), "AI");
        when(interviewCoachService.evaluate(any(InterviewEvaluateRequest.class))).thenReturn(aiFeedback);
        when(quotaService.remainingOfDay(eq(1L), eq(Resource.AI_EVALUATE))).thenReturn(2);

        mockMvc.perform(post("/api/interview/evaluate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.remainingToday", is(2)));

        verify(quotaService).consume(1L, Resource.AI_EVALUATE);
    }

    @Test
    void quotaExhaustedReturnsBillingCode() throws Exception {
        doThrow(new BusinessException(40301, "今日免费额度已用完"))
                .when(quotaService).ensureAvailable(1L, Resource.AI_EVALUATE);

        mockMvc.perform(post("/api/interview/evaluate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())))
                // 40301 不是合法 HTTP 状态码，统一异常处理映射为 400，业务码保留在响应体
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(40301)));

        verify(interviewCoachService, never()).evaluate(any());
    }

    @Test
    void evaluateWithoutLoginReturns401() throws Exception {
        AuthUserContext.clear();

        mockMvc.perform(post("/api/interview/evaluate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(401)));
    }

    private InterviewFeedbackVO ruleBasedFeedback() {
        return new InterviewFeedbackVO(
                88,
                "strong",
                List.of(new InterviewCriterionVO("coverage", "知识覆盖", 90, "覆盖完整")),
                List.of("补一个线上例子"),
                List.of("如果换成 ConcurrentHashMap 呢？"),
                "RULE_BASED"
        );
    }

    private InterviewEvaluateRequest sampleRequest() {
        return new InterviewEvaluateRequest(
                "HashMap 为什么线程不安全？",
                "Java 集合",
                List.of("HashMap"),
                "HARD",
                "Java 后端",
                "HashMap 并发写 resize 有风险，可以换 ConcurrentHashMap。"
        );
    }
}
