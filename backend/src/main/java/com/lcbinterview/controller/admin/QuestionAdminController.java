package com.lcbinterview.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.QuestionAdminVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
        Page<Question> mpPage = new Page<>(page, size);
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, "DRAFT")
                .orderByDesc(Question::getCreateTime);
        IPage<Question> result = questionMapper.selectPage(mpPage, wrapper);
        Page<QuestionAdminVO> voPage = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());
        voPage.setRecords(result.getRecords().stream().map(QuestionAdminVO::from).toList());
        return ResponseEntity.ok(ApiResponse.ok(voPage));
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
        return ResponseEntity.ok(ApiResponse.ok(QuestionAdminVO.from(q)));
    }

    /**
     * 编辑保存草稿。
     */
    @PutMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<Void>> updateDraft(@PathVariable Long id,
                                                          @RequestBody Question question) {
        question.setId(id);
        questionMapper.updateById(question);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    /**
     * 审核通过。
     */
    @PostMapping("/draft/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approve(@PathVariable Long id) {
        Question q = new Question();
        q.setId(id);
        q.setStatus("PUBLISHED");
        questionMapper.updateById(q);
        return ResponseEntity.ok(ApiResponse.ok(null));
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
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
