package com.lcbinterview.controller.admin;

import com.lcbinterview.config.AdminTokenFilter;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.BatchGenerationRunner;
import com.lcbinterview.service.CategoryService;
import com.lcbinterview.service.QuestionService;
import com.lcbinterview.mapper.TagMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端 Token 校验接口测试，验证前端登录依赖的 /api/admin/verify 可用。
 */
@WebMvcTest(AdminAuthController.class)
@Import(AdminTokenFilter.class)
@TestPropertySource(properties = "admin.token=test-token")
class AdminAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private QuestionMapper questionMapper;

    @MockBean
    private AiQuestionService aiQuestionService;

    @MockBean
    private BatchGenerationRunner batchGenerationRunner;

    @MockBean
    private CategoryService categoryService;

    @MockBean
    private QuestionService questionService;

    @MockBean
    private TagMapper tagMapper;

    @Test
    void verifyReturnsSuccessWhenAdminTokenIsValid() throws Exception {
        mockMvc.perform(get("/api/admin/verify")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(200)))
                .andExpect(jsonPath("$.message", is("success")));
    }

    @Test
    void verifyRejectsMissingAdminToken() throws Exception {
        mockMvc.perform(get("/api/admin/verify"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(401)))
                .andExpect(jsonPath("$.message", is("Unauthorized")));
    }
}
