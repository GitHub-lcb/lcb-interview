package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.service.LotteryKl8AutoRecommendationScheduler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 彩种运维后台接口：为运营提供手动触发当期推荐生成的能力。
 * <p>
 * 典型场景是玩法口径升级（例如选4 改为选5）后立即补生成，避免用户一直看到旧口径记录，
 * 无需等到每天 22:35 的自动调度。
 */
@Slf4j
@Tag(name = "彩种运维后台")
@RestController
@RequestMapping("/api/admin/lottery")
@RequiredArgsConstructor
public class AdminLotteryController {

    private final LotteryKl8AutoRecommendationScheduler autoRecommendationScheduler;

    /**
     * 为所有活跃用户重新生成当期快乐8推荐。
     * 已存在同口径（选5 + 当前策略版本）推荐的用户会被跳过，不会重复生成。
     *
     * @return 本次实际生成的推荐条数
     */
    @Operation(summary = "重新生成当期快乐8推荐")
    @PostMapping("/kl8/regenerate-current")
    public ResponseEntity<ApiResponse<Integer>> regenerateCurrentKl8Recommendations() {
        int generated = autoRecommendationScheduler.autoRecommendDaily();
        log.info("后台手动触发当期快乐8推荐生成: 生成 {} 条", generated);
        return ResponseEntity.ok(ApiResponse.success(generated));
    }
}
