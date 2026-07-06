package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.TagVO;
import com.lcbinterview.service.TagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 标签管理接口。
 * @author chongan
 */
@Tag(name = "标签管理")
@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @Operation(summary = "获取所有标签")
    @GetMapping
    public ResponseEntity<ApiResponse<List<TagVO>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(tagService.getAllVos()));
    }
}
