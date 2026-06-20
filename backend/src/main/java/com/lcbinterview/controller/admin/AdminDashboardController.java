package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.AdminQualitySummaryVO;
import com.lcbinterview.service.AdminQualityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理后台总览接口，提供质量运营、审核压力和内容缺口相关数据。
 */
@Tag(name = "管理后台总览")
@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminQualityService adminQualityService;

    /**
     * 查询题库质量总览。
     *
     * @return 题目状态、分类风险排行和运营待办
     */
    @Operation(summary = "查询题库质量总览")
    @GetMapping("/quality-summary")
    public ResponseEntity<ApiResponse<AdminQualitySummaryVO>> qualitySummary() {
        return ResponseEntity.ok(ApiResponse.success(adminQualityService.buildSummary()));
    }
}
