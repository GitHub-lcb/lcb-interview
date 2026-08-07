package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.service.KnowledgePointCleaningService;
import com.lcbinterview.service.KnowledgePointCorpusService;
import com.lcbinterview.service.KnowledgePointWeightService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 高频考点管理接口，提供考点清洗、面经语料管道与权重重算能力。
 * Token 校验由 AdminTokenFilter 统一完成。
 */
@Tag(name = "高频考点管理")
@RestController
@RequestMapping("/api/admin/knowledge")
@RequiredArgsConstructor
public class KnowledgeAdminController {

    private final KnowledgePointCleaningService cleaningService;
    private final KnowledgePointCorpusService corpusService;
    private final KnowledgePointWeightService weightService;

    /**
     * 启动考点清洗任务（AI 分批给全量题目打考点 + 补标签）。
     *
     * @return 是否成功启动
     */
    @Operation(summary = "启动考点清洗任务")
    @PostMapping("/clean-start")
    public ResponseEntity<ApiResponse<Boolean>> cleanStart() {
        return ResponseEntity.ok(ApiResponse.success(cleaningService.start()));
    }

    /**
     * 查询考点清洗进度。
     *
     * @return 清洗进度
     */
    @Operation(summary = "查询考点清洗进度")
    @GetMapping("/clean-status")
    public ResponseEntity<ApiResponse<KnowledgePointCleaningService.CleanProgress>> cleanStatus() {
        return ResponseEntity.ok(ApiResponse.success(cleaningService.getProgress()));
    }

    /**
     * 导入面经语料条目（去重后入库，状态 RAW）。
     *
     * @param items 面经条目
     * @return 新增条数
     */
    @Operation(summary = "导入面经语料")
    @PostMapping("/corpus/import")
    public ResponseEntity<ApiResponse<Integer>> corpusImport(
            @RequestBody List<KnowledgePointCorpusService.CorpusItem> items) {
        return ResponseEntity.ok(ApiResponse.success(corpusService.importItems(items)));
    }

    /**
     * 启动面经语料考点提取任务（异步）。
     *
     * @return 是否成功启动
     */
    @Operation(summary = "启动语料考点提取")
    @PostMapping("/corpus/extract-start")
    public ResponseEntity<ApiResponse<Boolean>> corpusExtractStart() {
        return ResponseEntity.ok(ApiResponse.success(corpusService.startExtract()));
    }

    /**
     * 查询语料提取进度。
     *
     * @return 提取进度
     */
    @Operation(summary = "查询语料提取进度")
    @GetMapping("/corpus/status")
    public ResponseEntity<ApiResponse<KnowledgePointCorpusService.ExtractProgress>> corpusStatus() {
        return ResponseEntity.ok(ApiResponse.success(corpusService.getProgress()));
    }

    /**
     * 重算全量考点高频权重。
     *
     * @return 更新条数
     */
    @Operation(summary = "重算考点高频权重")
    @PostMapping("/weight-recalculate")
    public ResponseEntity<ApiResponse<Integer>> weightRecalculate() {
        return ResponseEntity.ok(ApiResponse.success(weightService.recalculate()));
    }
}
