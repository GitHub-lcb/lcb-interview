package com.lcbinterview.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.QuestionQuery;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.model.Question;
import com.lcbinterview.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 题目管理接口。提供分页搜索、详情查看、热门排行。
 * @author chongan
 */
@Slf4j
@Tag(name = "题目管理")
@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @Operation(summary = "分页查询题目（含搜索、筛选）")
    @GetMapping
    public ResponseEntity<ApiResponse<PageResult<QuestionVO>>> list(@Valid QuestionQuery query) {
        IPage<Question> page = questionService.search(
                query.category(), query.difficulty(), query.keyword(),
                query.tag(), query.page(), query.size());
        List<QuestionVO> list = page.getRecords().stream()
                .map(q -> QuestionVO.from(q, null, List.of()))
                .toList();
        log.info("搜索题目返回 {} 条（共 {} 条）", list.size(), page.getTotal());
        return ResponseEntity.ok(ApiResponse.success(PageResult.of(page, list)));
    }

    @Operation(summary = "获取题目详情")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QuestionVO>> getById(@PathVariable Long id) {
        Question question = questionService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(
                QuestionVO.from(question, null, List.of())));
    }

    @Operation(summary = "获取热门题目排行")
    @GetMapping("/hot")
    public ResponseEntity<ApiResponse<List<QuestionVO>>> getHot(
            @RequestParam(defaultValue = "10") int size) {
        List<Question> list = questionService.getHot(size);
        List<QuestionVO> vos = list.stream()
                .map(q -> QuestionVO.from(q, null, List.of()))
                .toList();
        log.info("查询热门题目 Top {}", size);
        return ResponseEntity.ok(ApiResponse.success(vos));
    }
}
