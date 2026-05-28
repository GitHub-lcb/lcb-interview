package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.model.Category;
import com.lcbinterview.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 分类管理接口。
 */
@Slf4j
@Tag(name = "分类管理")
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @Operation(summary = "获取全部分类")
    @GetMapping
    public ResponseEntity<ApiResponse<List<Category>>> getAll() {
        List<Category> list = categoryService.getAll();
        log.info("查询全部分类，共 {} 条", list.size());
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "获取分类详情")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Category>> getById(@PathVariable Long id) {
        Category category = categoryService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(category));
    }
}
