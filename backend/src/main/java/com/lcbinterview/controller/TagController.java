package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.mapper.TagMapper;
import com.lcbinterview.model.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 标签管理接口。
 * @author chongan
 */
@Slf4j
@Tag(name = "标签管理")
@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagMapper tagMapper;

    @Operation(summary = "获取所有标签")
    @GetMapping
    public ResponseEntity<ApiResponse<List<Tag>>> getAll() {
        List<Tag> list = tagMapper.selectList(null);
        log.info("查询全部标签，共 {} 条", list.size());
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
