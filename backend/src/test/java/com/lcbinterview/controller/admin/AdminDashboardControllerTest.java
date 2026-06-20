package com.lcbinterview.controller.admin;

import com.lcbinterview.config.AdminTokenFilter;
import com.lcbinterview.dto.AdminQualitySummaryVO;
import com.lcbinterview.service.AdminQualityService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理后台总览接口测试，确保质量数据以统一响应格式返回。
 */
@WebMvcTest(AdminDashboardController.class)
@Import(AdminTokenFilter.class)
@TestPropertySource(properties = "admin.token=test-token")
class AdminDashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminQualityService adminQualityService;

    @Test
    void qualitySummaryReturnsAdminQualityMetrics() throws Exception {
        when(adminQualityService.buildSummary()).thenReturn(new AdminQualitySummaryVO(
                10,
                6,
                3,
                1,
                2,
                4,
                60,
                List.of(),
                List.of()));

        mockMvc.perform(get("/api/admin/dashboard/quality-summary")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)))
                .andExpect(jsonPath("$.data.totalQuestions", is(10)))
                .andExpect(jsonPath("$.data.emptyAnswerQuestions", is(2)))
                .andExpect(jsonPath("$.data.completionRate", is(60)));
    }
}
