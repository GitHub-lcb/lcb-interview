package com.lcbinterview.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.QuestionAdminVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 管理端题目接口。草稿列表、编辑、审核通过/驳回。
 * @author chongan
 */
@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class QuestionAdminController {

    private final QuestionMapper questionMapper;

    /**
     * 草稿分页列表。
     */
    @GetMapping("/draft")
    public ResponseEntity<ApiResponse<IPage<QuestionAdminVO>>> listDrafts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Question> mpPage = new Page<>(Math.max(1, page + 1), size);
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, "DRAFT")
                .orderByAsc(Question::getId)
                .orderByDesc(Question::getUpdateTime);
        IPage<Question> result = questionMapper.selectPage(mpPage, wrapper);
        Page<QuestionAdminVO> voPage = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());
        voPage.setRecords(result.getRecords().stream().map(QuestionAdminVO::from).toList());
        return ResponseEntity.ok(ApiResponse.success(voPage));
    }

    /**
     * 草稿详情。
     */
    @GetMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<QuestionAdminVO>> getDraft(@PathVariable Long id) {
        Question q = questionMapper.selectById(id);
        if (q == null) {
            return ResponseEntity.ok(ApiResponse.error(404, "题目不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success(QuestionAdminVO.from(q)));
    }

    /**
     * 编辑保存草稿。
     */
    @PutMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<Void>> updateDraft(@PathVariable Long id,
                                                          @RequestBody Question question) {
        question.setId(id);
        questionMapper.updateById(question);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 审核通过。
     */
    @PostMapping("/draft/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approve(@PathVariable Long id) {
        Question existing = questionMapper.selectById(id);
        if (existing == null) {
            return ResponseEntity.ok(ApiResponse.error(404, "题目不存在"));
        }
        if (isContentBlank(existing)) {
            return ResponseEntity.ok(ApiResponse.error(400, "题目答案为空，不能发布"));
        }
        Question q = new Question();
        q.setId(id);
        q.setStatus("PUBLISHED");
        questionMapper.updateById(q);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 审核驳回。
     */
    @PostMapping("/draft/{id}/reject")
    public ResponseEntity<ApiResponse<Void>> reject(@PathVariable Long id) {
        Question q = new Question();
        q.setId(id);
        q.setStatus("REJECTED");
        questionMapper.updateById(q);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 批量审核通过。
     */
    @PostMapping("/draft/batch-approve")
    public ResponseEntity<ApiResponse<Void>> batchApprove(@RequestBody List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error(400, "ID 列表不能为空"));
        }
        List<Question> drafts = questionMapper.selectBatchIds(ids);
        boolean hasBlankContent = drafts.stream()
                .filter(q -> "DRAFT".equals(q.getStatus()))
                .anyMatch(this::isContentBlank);
        if (hasBlankContent) {
            return ResponseEntity.ok(ApiResponse.error(400, "存在答案为空的草稿，不能批量发布"));
        }
        questionMapper.update(null, new LambdaUpdateWrapper<Question>()
                .set(Question::getStatus, "PUBLISHED")
                .in(Question::getId, ids)
                .eq(Question::getStatus, "DRAFT")
                // 校验和更新都限制非空内容，避免并发窗口把空答案发布出去。
                .isNotNull(Question::getContent)
                .apply("TRIM(content) <> ''"));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 批量审核驳回。
     */
    @PostMapping("/draft/batch-reject")
    public ResponseEntity<ApiResponse<Void>> batchReject(@RequestBody List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error(400, "ID 列表不能为空"));
        }
        questionMapper.update(null, new LambdaUpdateWrapper<Question>()
                .set(Question::getStatus, "REJECTED")
                .in(Question::getId, ids)
                .eq(Question::getStatus, "DRAFT"));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private boolean isContentBlank(Question question) {
        String content = question.getContent();
        return content == null || content.isBlank();
    }
}
