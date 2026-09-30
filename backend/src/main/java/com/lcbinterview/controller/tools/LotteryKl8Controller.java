package com.lcbinterview.controller.tools;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotteryKl8DrawVO;
import com.lcbinterview.dto.tools.LotteryKl8CoverageReportVO;
import com.lcbinterview.dto.tools.LotteryKl8JevCalibrationRequest;
import com.lcbinterview.dto.tools.LotteryKl8JevProbeRequest;
import com.lcbinterview.dto.tools.LotteryKl8JevStatusVO;
import com.lcbinterview.dto.tools.LotteryKl8LabReportVO;
import com.lcbinterview.dto.tools.LotteryKl8LabRequest;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationVO;
import com.lcbinterview.dto.tools.LotteryKl8SyncResultVO;
import com.lcbinterview.dto.tools.LotteryKl8SyncStatusVO;
import com.lcbinterview.service.JevRuntimeConfigService;
import com.lcbinterview.service.LotteryKl8FeatureReport;
import com.lcbinterview.service.LotteryKl8FeatureService;
import com.lcbinterview.service.LotteryKl8CoverageService;
import com.lcbinterview.service.LotteryKl8JevCalibrationReport;
import com.lcbinterview.service.LotteryKl8JevCalibrationService;
import com.lcbinterview.service.LotteryKl8JevProbabilityResult;
import com.lcbinterview.service.LotteryKl8JevProbabilityService;
import com.lcbinterview.service.LotteryKl8LabService;
import com.lcbinterview.service.LotteryKl8RecommendationEvaluationService;
import com.lcbinterview.service.LotteryKl8RecommendationPolicy;
import com.lcbinterview.service.LotteryKl8RecommendationService;
import com.lcbinterview.service.LotteryKl8StrategyCalibration;
import com.lcbinterview.service.LotteryKl8SyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 快乐8工具接口，提供开奖同步、历史开奖和 Java 规则推荐能力，当前统一为选4玩法。
 */
@Slf4j
@Tag(name = "快乐8工具")
@RestController
@RequestMapping("/api/tools/lottery/kl8")
@RequiredArgsConstructor
public class LotteryKl8Controller {

    /** Jev 相关接口的默认历史期数，与实验室默认口径一致。 */
    private static final int DEFAULT_JEV_BASE_ISSUE_COUNT = LotteryKl8JevCalibrationService.DEFAULT_BASE_ISSUE_COUNT;

    private final LotteryKl8SyncService syncService;
    private final LotteryKl8RecommendationService recommendationService;
    private final LotteryKl8RecommendationEvaluationService evaluationService;
    private final LotteryKl8LabService labService;
    private final LotteryKl8CoverageService coverageService;
    private final LotteryKl8FeatureService featureService;
    private final LotteryKl8JevProbabilityService jevProbabilityService;
    private final LotteryKl8JevCalibrationService jevCalibrationService;
    private final JevRuntimeConfigService jevRuntimeConfigService;

    /**
     * 手动同步快乐8开奖数据。
     *
     * @return 同步结果
     */
    @Operation(summary = "同步快乐8开奖数据")
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<LotteryKl8SyncResultVO>> sync() {
        return ResponseEntity.ok(ApiResponse.success(syncService.sync()));
    }

    /**
     * 查询快乐8开奖同步状态。
     *
     * @return 同步状态
     */
    @Operation(summary = "查询快乐8同步状态")
    @GetMapping("/sync-status")
    public ResponseEntity<ApiResponse<LotteryKl8SyncStatusVO>> syncStatus() {
        return ResponseEntity.ok(ApiResponse.success(syncService.status()));
    }

    /**
     * 分页查询快乐8近期开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 分页开奖记录
     */
    @Operation(summary = "查询快乐8近期开奖")
    @GetMapping("/draws")
    public ResponseEntity<ApiResponse<PageResult<LotteryKl8DrawVO>>> draws(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(ApiResponse.success(syncService.listDraws(page, size)));
    }

    /**
     * 生成当前用户的快乐8选4推荐。
     *
     * @param request 推荐请求
     * @return 推荐结果
     */
    @Operation(summary = "生成快乐8推荐")
    @PostMapping("/recommendations")
    public ResponseEntity<ApiResponse<LotteryKl8RecommendationVO>> recommend(
            @Valid @RequestBody LotteryKl8RecommendationRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.recommend(AuthUserContext.currentUserId(), request)));
    }

    /**
     * 手动结算所有待结算推荐。已全部结算时返回 0，前端据此提示用户。
     *
     * @return 本次结算的推荐条数
     */
    @Operation(summary = "手动结算推荐命中")
    @PostMapping("/evaluate")
    public ResponseEntity<ApiResponse<Integer>> evaluate() {
        int evaluated = evaluationService.evaluatePendingRecommendations();
        log.info("手动结算推荐命中: {} 条", evaluated);
        return ResponseEntity.ok(ApiResponse.success(evaluated));
    }

    /**
     * 运行快乐8概率实验室：权重寻优 + 投注组合实验。
     *
     * @param request 实验参数
     * @return 实验室报告
     */
    @Operation(summary = "运行快乐8概率实验室")
    @PostMapping("/lab")
    public ResponseEntity<ApiResponse<LotteryKl8LabReportVO>> lab(
            @Valid @RequestBody LotteryKl8LabRequest request) {
        return ResponseEntity.ok(ApiResponse.success(labService.run(AuthUserContext.currentUserId(), request)));
    }

    /**
     * 查询快乐8覆盖优化报告：把「花多少钱能买到多少中奖概率」换算成精确曲线。
     * <p>
     * 该接口是纯组合数学计算，不读用户数据也不返回号码预测，
     * 用于纠正「选号策略能提高中奖率」的误解：单注概率是常量，只能靠加注数买概率。
     *
     * @param pickSize    每注选号数量，空值时回退站点默认口径
     * @param minHitLevel 达标口径（至少命中几个），空值时默认 2
     * @param maxTickets  曲线最大注数，空值时默认 20
     * @param budgetYuan  预算上限（元），空值时不做预算分析
     * @return 覆盖优化报告
     */
    @Operation(summary = "查询快乐8覆盖优化与预算概率曲线")
    @GetMapping("/coverage")
    public ResponseEntity<ApiResponse<LotteryKl8CoverageReportVO>> coverage(
            @RequestParam(required = false) Integer pickSize,
            @RequestParam(required = false) Integer minHitLevel,
            @RequestParam(required = false) Integer maxTickets,
            @RequestParam(required = false) Double budgetYuan) {
        int effectivePickSize = pickSize == null
                ? LotteryKl8RecommendationPolicy.DEFAULT_PICK_SIZE
                : pickSize;
        return ResponseEntity.ok(ApiResponse.success(coverageService.report(
                effectivePickSize,
                minHitLevel == null ? 0 : minHitLevel,
                maxTickets == null ? 0 : maxTickets,
                budgetYuan == null ? 0 : budgetYuan)));
    }

    /**
     * 分页查询当前用户的快乐8推荐历史。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 推荐历史
     */
    @Operation(summary = "查询快乐8推荐历史")
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<PageResult<LotteryKl8RecommendationVO>>> recommendations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                recommendationService.list(AuthUserContext.currentUserId(), page, size)));
    }

    /**
     * 查询 Jev 决策模型配置状态。密钥只返回脱敏值。
     *
     * @return Jev 配置状态
     */
    @Operation(summary = "查询 Jev 决策模型配置状态")
    @GetMapping("/jev/status")
    public ResponseEntity<ApiResponse<LotteryKl8JevStatusVO>> jevStatus() {
        return ResponseEntity.ok(ApiResponse.success(jevRuntimeConfigService.publicStatus()));
    }

    /**
     * 使用 Jev 推算下一期 80 个号码的开出概率。
     * 返回结果附带偏差统计与中文解读，概率本身不改变号码的实际开出概率。
     *
     * @param request 推算请求
     * @return 概率推算结果
     */
    @Operation(summary = "推算快乐8号码开出概率（Jev）")
    @PostMapping("/jev/probability")
    public ResponseEntity<ApiResponse<LotteryKl8JevProbabilityResult>> jevProbability(
            @Valid @RequestBody LotteryKl8JevProbeRequest request) {
        int pickSize = resolvePickSize(request.pickSize());
        int baseIssueCount = request.baseIssueCount() == null
                ? DEFAULT_JEV_BASE_ISSUE_COUNT
                : request.baseIssueCount();
        LotteryKl8FeatureReport report = featureService.buildReport(
                baseIssueCount, LotteryKl8StrategyCalibration.neutral(), pickSize);
        return ResponseEntity.ok(ApiResponse.success(jevProbabilityService.estimate(report, pickSize)));
    }

    /**
     * 运行 Jev 号码概率校准闸门。
     * 采用走查前推逐期比对，判定 Jev 概率是否具备优于 25% 随机基线的证据；
     * 未通过时闸门保持关闭，概率不得参与推荐排序。
     *
     * @param request 校准请求
     * @return 校准报告
     */
    @Operation(summary = "运行 Jev 号码概率校准闸门")
    @PostMapping("/jev/calibration")
    public ResponseEntity<ApiResponse<LotteryKl8JevCalibrationReport>> jevCalibration(
            @Valid @RequestBody LotteryKl8JevCalibrationRequest request) {
        int pickSize = resolvePickSize(request.pickSize());
        int issues = request.issues() == null ? LotteryKl8JevCalibrationService.DEFAULT_ISSUES : request.issues();
        int baseIssueCount = request.baseIssueCount() == null
                ? DEFAULT_JEV_BASE_ISSUE_COUNT
                : request.baseIssueCount();
        return ResponseEntity.ok(ApiResponse.success(
                jevCalibrationService.calibrate(issues, baseIssueCount, pickSize)));
    }

    /**
     * 统一解析选号数量，空值时回退站点默认口径。
     *
     * @param pickSize 请求中的选号数量
     * @return 生效的选号数量
     */
    private int resolvePickSize(Integer pickSize) {
        return pickSize == null ? LotteryKl8RecommendationPolicy.DEFAULT_PICK_SIZE : pickSize;
    }
}
