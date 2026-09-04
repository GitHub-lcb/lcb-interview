package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.QuestionQuery;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.service.AnkiExportService;
import com.lcbinterview.service.AnswerPremiumGate;
import com.lcbinterview.service.AuthTokenService;
import com.lcbinterview.service.MembershipQuotaPolicy.Resource;
import com.lcbinterview.service.QuestionService;
import com.lcbinterview.service.QuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
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
    private final AnkiExportService ankiExportService;
    private final AnswerPremiumGate answerPremiumGate;
    private final QuotaService quotaService;
    private final AuthTokenService authTokenService;

    @Operation(summary = "分页查询题目（含搜索、筛选）")
    @GetMapping
    public ResponseEntity<ApiResponse<PageResult<QuestionVO>>> list(@Valid QuestionQuery query) {
        PageResult<QuestionVO> page = questionService.searchVo(
                query.category(), query.difficulty(), query.keyword(),
                query.tag(), query.page(), query.size(), query.sort());
        log.info("搜索题目返回 {} 条（共 {} 条）", page.content().size(), page.total());
        return ResponseEntity.ok(ApiResponse.success(page));
    }

    @Operation(summary = "获取题目详情")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QuestionVO>> getById(@PathVariable Long id, HttpServletRequest request) {
        QuestionVO detail = questionService.getVoById(id);
        // 详情接口保持公开访问，仅可选解析登录态用于会员墙判定，游客仍可看公开字段
        QuestionVO gated = answerPremiumGate.apply(detail, resolveOptionalUserId(request));
        return ResponseEntity.ok(ApiResponse.success(gated));
    }

    @Operation(summary = "获取热门题目排行")
    @GetMapping("/hot")
    public ResponseEntity<ApiResponse<List<QuestionVO>>> getHot(
            @RequestParam(defaultValue = "10") int size) {
        log.info("查询热门题目 Top {}", size);
        return ResponseEntity.ok(ApiResponse.success(questionService.getHotVo(size)));
    }

    /**
     * 按 ID 列表批量查询已发布题目，用于详情页关联题目渲染。
     * 仅返回 PUBLISHED 题目，避免通过关联 ID 暴露草稿/驳回题。
     */
    @Operation(summary = "按 ID 列表批量查询题目")
    @GetMapping("/list")
    public ResponseEntity<ApiResponse<List<QuestionVO>>> listByIds(
            @RequestParam("ids") List<Long> ids) {
        List<QuestionVO> result = questionService.listPublishedVosByIds(ids);
        log.info("按 ID 批量查询题目，请求 {} 条，命中 {} 条", ids == null ? 0 : ids.size(), result.size());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 导出已发布题目为 Anki 可导入的 TSV 文件，需登录并受每日导出配额管控。
     *
     * <p>Anki 导入方法：打开 Anki - 文件 - 导入，选择下载的 .txt 文件，
     * 分隔符选择“制表符”，字段映射为 正面/背面/标签，并勾选“允许在字段中使用 HTML”。</p>
     *
     * @param category   分类 ID，可选，不传导出全部分类
     * @param difficulty 难度筛选，可选（EASY/MEDIUM/HARD）
     * @param limit      导出条数，默认 100，归一化到 1~500
     * @return TSV 文件字节流
     */
    @Operation(summary = "导出题目为 Anki TSV 文件",
            description = "每行一条笔记，三列：正面(题目标题)、背面(答案 HTML)、标签(分类::难度)。"
                    + "Anki 导入时分隔符选 Tab，并允许字段使用 HTML。需登录，受每日导出配额管控。")
    @GetMapping("/anki-export")
    public ResponseEntity<byte[]> exportAnki(
            @RequestParam(value = "category", required = false) Long category,
            @RequestParam(value = "difficulty", required = false) String difficulty,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        Long userId = AuthUserContext.currentUserId();
        // 先预检后消耗，额度不足时直接报错，不白自构建大体量 TSV
        quotaService.ensureAvailable(userId, Resource.EXPORT);
        String tsv = ankiExportService.buildAnkiTsv(category, difficulty, limit);
        quotaService.consume(userId, Resource.EXPORT);
        // 文件名保持 ASCII（分类用 ID 而非中文名），避免不同浏览器对非 ASCII 文件名编码不一致
        String fileKey = category == null ? "all" : String.valueOf(category);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "tab-separated-values", StandardCharsets.UTF_8));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("lcb-interview-anki-" + fileKey + ".txt", StandardCharsets.UTF_8)
                .build());
        log.info("Anki 导出请求，userId={}, category={}, difficulty={}, limit={}, 输出 {} 字符",
                userId, category, difficulty, limit, tsv.length());
        return ResponseEntity.ok().headers(headers).body(tsv.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 可选解析当前登录用户。无效或缺失令牌时返回 null 按游客处理，
     * 保证公开浏览不受影响。
     */
    private Long resolveOptionalUserId(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        try {
            return authTokenService.parseUserId(header.substring("Bearer ".length()));
        } catch (RuntimeException e) {
            return null;
        }
    }
}
