package com.lcbinterview.controller.admin;

import com.lcbinterview.config.AdminTokenFilter;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端草稿审核接口测试，确保空答案草稿不会被发布到公开题库。
 */
@WebMvcTest(QuestionAdminController.class)
@Import(AdminTokenFilter.class)
@TestPropertySource(properties = "admin.token=test-token")
class QuestionAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private QuestionMapper questionMapper;

    @Test
    void approveRejectsDraftWithoutContent() throws Exception {
        Question draft = new Question();
        draft.setId(10L);
        draft.setStatus("DRAFT");
        draft.setContent("");
        when(questionMapper.selectById(10L)).thenReturn(draft);

        mockMvc.perform(post("/api/admin/questions/draft/10/approve")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(400)))
                .andExpect(jsonPath("$.message", is("题目答案为空，不能发布")));

        verify(questionMapper, never()).updateById(any(Question.class));
    }

    @Test
    void batchApproveRejectsWhenAnyDraftHasNoContent() throws Exception {
        Question emptyDraft = new Question();
        emptyDraft.setId(10L);
        emptyDraft.setStatus("DRAFT");
        emptyDraft.setContent("");
        when(questionMapper.selectBatchIds(List.of(10L, 11L))).thenReturn(List.of(emptyDraft));

        mockMvc.perform(post("/api/admin/questions/draft/batch-approve")
                        .header("Authorization", "Bearer test-token")
                        .contentType("application/json")
                        .content("[10,11]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(400)))
                .andExpect(jsonPath("$.message", is("存在答案为空的草稿，不能批量发布")));

        verify(questionMapper, never()).update(any(), any());
    }
}
