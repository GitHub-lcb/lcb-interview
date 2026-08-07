package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.KnowledgePointVO;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.service.KnowledgePointService;
import com.lcbinterview.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 高频考点公开接口：考点排行与考点下题目查询，无需登录。
 */
@Slf4j
@Tag(name = "高频考点")
@RestController
@RequestMapping("/api/knowledge-points")
@RequiredArgsConstructor
public class KnowledgePointController {

    private final KnowledgePointService knowledgePointService;
    private final QuestionService questionService;

    /**
     * 查询高频考点排行，支持按分类筛选。
     *
     * @param category 分类 ID，可选
     * @param size     返回条数，默认 20，上限 100
     * @return 考点排行列表
     */
    @Operation(summary = "查询高频考点排行")
    @GetMapping("/hot")
    public ResponseEntity<ApiResponse<List<KnowledgePointVO>>> hot(
            @RequestParam(required = false) Long category,
            @RequestParam(defaultValue = "20") int size) {
        List<KnowledgePointVO> points = knowledgePointService.hotPoints(category, size);
        log.info("返回高频考点排行 {} 条", points.size());
        return ResponseEntity.ok(ApiResponse.success(points));
    }

    /**
     * 分页查询考点关联的已发布题目。
     *
     * @param id   考点 ID
     * @param page 页码，从 0 开始
     * @param size 每页条数
     * @return 题目分页结果
     */
    @Operation(summary = "查询考点下的题目")
    @GetMapping("/{id}/questions")
    public ResponseEntity<ApiResponse<PageResult<QuestionVO>>> questions(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResult<QuestionVO> result = questionService.searchVoByKnowledgePoint(id, page, size);
        log.info("返回考点 {} 题目 {} 条（共 {} 条）", id, result.content().size(), result.total());
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
