package com.lcbinterview.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.QuestionAdminVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import com.lcbinterview.service.AiAnswerQualityPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

/**
 * 管理端题目接口。草稿列表、编辑、审核通过/驳回。
 * @author chongan
 */
@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class QuestionAdminController {

    private static final int SHORT_ANSWER_MIN_CHARS = 500;
    private static final int SUMMARY_MIN_CHARS = 40;
    private static final int PRINCIPLE_MIN_CHARS = 120;
    private static final int DETAIL_MIN_CHARS = 80;
    private static final String SOURCE_AI_REWRITE = "AI_REWRITE";

    private final QuestionMapper questionMapper;
    private final AiAnswerQualityPolicy aiAnswerQualityPolicy;

    /**
     * 草稿分页列表。
     */
    @GetMapping("/draft")
    public ResponseEntity<ApiResponse<IPage<QuestionAdminVO>>> listDrafts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String riskType,
            @RequestParam(required = false) String contentStatus) {
        Page<Question> mpPage = new Page<>(Math.max(1, page + 1), Math.min(100, Math.max(1, size)));
        QueryWrapper<Question> wrapper = new QueryWrapper<Question>()
                .eq("status", "DRAFT")
                .orderByAsc("id")
                .orderByDesc("update_time");
        applyDraftFilters(wrapper, categoryId, difficulty, keyword, riskType, contentStatus);
        IPage<Question> result = questionMapper.selectPage(mpPage, wrapper);
        Page<QuestionAdminVO> voPage = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());
        voPage.setRecords(result.getRecords().stream().map(QuestionAdminVO::from).toList());
        return ResponseEntity.ok(ApiResponse.success(voPage));
    }

    private void applyDraftFilters(
            QueryWrapper<Question> wrapper,
            Long categoryId,
            String difficulty,
            String keyword,
            String riskType,
            String contentStatus) {
        if (categoryId != null) {
            wrapper.eq("category_id", categoryId);
        }
        if (!isBlank(difficulty)) {
            wrapper.eq("difficulty", difficulty.trim());
        }
        if (!isBlank(keyword)) {
            String normalizedKeyword = keyword.trim();
            wrapper.and(q -> q.like("title", normalizedKeyword)
                    .or()
                    .like("summary", normalizedKeyword)
                    .or()
                    .like("content", normalizedKeyword));
        }
        applyContentStatusFilter(wrapper, contentStatus);
        applyRiskFilter(wrapper, riskType);
    }

    private void applyContentStatusFilter(QueryWrapper<Question> wrapper, String contentStatus) {
        if (isBlank(contentStatus)) {
            return;
        }
        switch (contentStatus.trim().toUpperCase()) {
            case "EMPTY" -> wrapper.apply("""
                    ((content IS NULL OR TRIM(content) = '')
                    AND (answer IS NULL OR TRIM(answer) = ''))
                    """);
            case "WITH_CONTENT" -> wrapper.apply("""
                    ((content IS NOT NULL AND TRIM(content) <> '')
                    OR (answer IS NOT NULL AND TRIM(answer) <> ''))
                    """);
            default -> {
                // 未识别的内容筛选不参与过滤，避免旧 URL 或手工参数让审核列表不可用。
            }
        }
    }

    private void applyRiskFilter(QueryWrapper<Question> wrapper, String riskType) {
        if (isBlank(riskType)) {
            return;
        }
        switch (riskType.trim().toUpperCase()) {
            case "EMPTY_ANSWER" -> wrapper.and(q -> q.isNull("content").or().apply("TRIM(content) = ''"));
            case "SHORT_ANSWER" -> wrapper.apply(
                    "content IS NOT NULL AND TRIM(content) <> '' AND CHAR_LENGTH(content) < {0}",
                    SHORT_ANSWER_MIN_CHARS);
            case "MISSING_SUMMARY" -> applyShortTextFilter(wrapper, "summary", SUMMARY_MIN_CHARS);
            case "MISSING_PRINCIPLE" -> applyShortTextFilter(wrapper, "principle", PRINCIPLE_MIN_CHARS);
            case "MISSING_COMPARISON" -> applyShortTextFilter(wrapper, "comparison", DETAIL_MIN_CHARS);
            case "MISSING_SCENARIO" -> applyShortTextFilter(wrapper, "scenario", DETAIL_MIN_CHARS);
            case "MISSING_RISK" -> applyShortTextFilter(wrapper, "risk", DETAIL_MIN_CHARS);
            case "MISSING_PROJECT_EXP" -> applyShortTextFilter(wrapper, "project_exp", DETAIL_MIN_CHARS);
            case "MISSING_CODE_EXAMPLES" -> applyMissingFieldFilter(wrapper, "code_examples");
            case "MISSING_CONTENT_SECTIONS" -> wrapper.and(q -> q.notLike("content", "30 秒口述版")
                    .or()
                    .notLike("content", "标准答案")
                    .or()
                    .notLike("content", "面试官评分点")
                    .or()
                    .notLike("content", "高频追问"));
            case "INVALID_DIFFICULTY" -> wrapper.and(q -> q.isNull("difficulty")
                    .or()
                    .notIn("difficulty", "EASY", "MEDIUM", "HARD"));
            default -> {
                // 未识别的风险类型不参与过滤，避免前端旧参数导致列表不可用。
            }
        }
    }

    private void applyShortTextFilter(QueryWrapper<Question> wrapper, String column, int minLength) {
        wrapper.and(q -> q.isNull(column)
                .or()
                .apply("TRIM(" + column + ") = ''")
                .or()
                .apply("CHAR_LENGTH(" + column + ") < {0}", minLength));
    }

    private void applyMissingFieldFilter(QueryWrapper<Question> wrapper, String column) {
        wrapper.and(q -> q.isNull(column)
                .or()
                .apply("TRIM(" + column + ") = ''")
                .or()
                .apply("TRIM(" + column + ") = '[]'")
                .or()
                .apply("TRIM(" + column + ") = 'null'"));
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
        AiAnswerQualityPolicy.QualityReport qualityReport = evaluateDraftQuality(existing);
        if (!qualityReport.passed()) {
            return ResponseEntity.ok(ApiResponse.error(400, "题目质量未达标：" + summarizeQualityIssues(qualityReport)));
        }
        if (isRewriteDraft(existing)) {
            return ResponseEntity.ok(applyRewriteDraft(existing));
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
        for (Question draft : drafts) {
            if ("DRAFT".equals(draft.getStatus())) {
                AiAnswerQualityPolicy.QualityReport qualityReport = evaluateDraftQuality(draft);
                if (!qualityReport.passed()) {
                    return ResponseEntity.ok(ApiResponse.error(400,
                            "存在质量未达标的草稿：" + draftTitle(draft) + "；" + summarizeQualityIssues(qualityReport)));
                }
            }
        }
        List<Long> regularDraftIds = new ArrayList<>();
        for (Question draft : drafts) {
            if (!"DRAFT".equals(draft.getStatus())) {
                continue;
            }
            if (isRewriteDraft(draft)) {
                ApiResponse<Void> rewriteResponse = applyRewriteDraft(draft);
                if (rewriteResponse.code() != 200) {
                    return ResponseEntity.ok(rewriteResponse);
                }
            } else {
                regularDraftIds.add(draft.getId());
            }
        }
        if (!regularDraftIds.isEmpty()) {
            questionMapper.update(null, new UpdateWrapper<Question>()
                    .set("status", "PUBLISHED")
                    .in("id", regularDraftIds)
                    .eq("status", "DRAFT")
                    // 校验和更新都限制非空内容，避免并发窗口把空答案发布出去。
                    .isNotNull("content")
                    .apply("TRIM(content) <> ''"));
        }
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

    private boolean isRewriteDraft(Question question) {
        return SOURCE_AI_REWRITE.equals(question.getSource());
    }

    private ApiResponse<Void> applyRewriteDraft(Question rewriteDraft) {
        Long originalId = parseRewriteOriginalId(rewriteDraft);
        if (originalId == null) {
            return ApiResponse.error(400, "重写草稿缺少原题关联 ID");
        }
        Question original = questionMapper.selectById(originalId);
        if (original == null || !"PUBLISHED".equals(original.getStatus())) {
            return ApiResponse.error(400, "原已发布题目不存在或状态不是已发布");
        }

        Question update = buildOriginalAnswerUpdate(originalId, rewriteDraft);
        questionMapper.updateById(update);
        // 重写草稿只是审核载体，应用成功后逻辑删除，避免前台出现重复题目。
        questionMapper.deleteById(rewriteDraft.getId());
        return ApiResponse.success(null);
    }

    private Question buildOriginalAnswerUpdate(Long originalId, Question rewriteDraft) {
        Question update = new Question();
        update.setId(originalId);
        update.setSummary(rewriteDraft.getSummary());
        update.setContent(rewriteDraft.getContent());
        update.setAnswer(rewriteDraft.getAnswer());
        update.setPrinciple(rewriteDraft.getPrinciple());
        update.setComparison(rewriteDraft.getComparison());
        update.setScenario(rewriteDraft.getScenario());
        update.setRisk(rewriteDraft.getRisk());
        update.setProjectExp(rewriteDraft.getProjectExp());
        update.setCodeExamples(rewriteDraft.getCodeExamples());
        update.setDiagrams(rewriteDraft.getDiagrams());
        return update;
    }

    private Long parseRewriteOriginalId(Question rewriteDraft) {
        String relatedIds = rewriteDraft.getRelatedIds();
        if (relatedIds == null || relatedIds.isBlank()) {
            return null;
        }
        String normalized = relatedIds.trim();
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1).trim();
        }
        int commaIndex = normalized.indexOf(',');
        if (commaIndex >= 0) {
            normalized = normalized.substring(0, commaIndex).trim();
        }
        normalized = normalized.replace("\"", "").replace("'", "").trim();
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private AiAnswerQualityPolicy.QualityReport evaluateDraftQuality(Question question) {
        AiAnswerQualityPolicy.QualityReport report = aiAnswerQualityPolicy.evaluateGeneratedQuestion("未知分类", question);
        if (report == null) {
            return new AiAnswerQualityPolicy.QualityReport(0, List.of("质量策略未返回评估结果"));
        }
        return report;
    }

    private String summarizeQualityIssues(AiAnswerQualityPolicy.QualityReport report) {
        if (!report.issues().isEmpty()) {
            return String.join("；", report.issues().stream().limit(3).toList());
        }
        return "质量分 " + report.score() + "，低于发布门槛";
    }

    private String draftTitle(Question question) {
        if (question.getTitle() == null || question.getTitle().isBlank()) {
            return "ID " + question.getId();
        }
        return question.getTitle();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
