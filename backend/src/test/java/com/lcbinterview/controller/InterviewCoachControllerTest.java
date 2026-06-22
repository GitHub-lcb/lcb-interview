package com.lcbinterview.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lcbinterview.dto.InterviewCriterionVO;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import com.lcbinterview.service.InterviewCoachService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 面试训练评分接口测试，验证前端调用依赖的响应格式。
 */
@WebMvcTest(InterviewCoachController.class)
class InterviewCoachControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private InterviewCoachService interviewCoachService;

    @Test
    void evaluateReturnsUnifiedApiResponse() throws Exception {
        when(interviewCoachService.evaluate(any(InterviewEvaluateRequest.class)))
                .thenReturn(new InterviewFeedbackVO(
                        88,
                        "strong",
                        List.of(new InterviewCriterionVO("coverage", "知识覆盖", 90, "覆盖完整")),
                        List.of("补一个线上例子"),
                        List.of("如果换成 ConcurrentHashMap 呢？"),
                        "RULE_BASED"
                ));

        InterviewEvaluateRequest request = new InterviewEvaluateRequest(
                "HashMap 为什么线程不安全？",
                "Java 集合",
                List.of("HashMap"),
                "HARD",
                "Java 后端",
                "HashMap 并发写 resize 有风险，可以换 ConcurrentHashMap。"
        );

        mockMvc.perform(post("/api/interview/evaluate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)))
                .andExpect(jsonPath("$.data.score", is(88)))
                .andExpect(jsonPath("$.data.level", is("strong")))
                .andExpect(jsonPath("$.data.criteria[0].key", is("coverage")))
                .andExpect(jsonPath("$.data.source", is("RULE_BASED")));
    }
}
