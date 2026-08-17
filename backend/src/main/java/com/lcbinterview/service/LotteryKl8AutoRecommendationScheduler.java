package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.mapper.LotteryKl8RecommendationMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.LotteryKl8Draw;
import com.lcbinterview.model.LotteryKl8Recommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 快乐8自动推荐调度器：每天开奖同步后为活跃用户自动生成一次推荐，
 * 让命中反馈与策略校准样本自动积累，无需用户手动点击。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8AutoRecommendationScheduler {

    private final AppUserMapper appUserMapper;
    private final LotteryKl8DrawMapper drawMapper;
    private final LotteryKl8RecommendationMapper recommendationMapper;
    private final LotteryKl8RecommendationService recommendationService;

    /**
     * 每天 08:00 执行：昨晚 22:30 已同步并结算，本任务在第二天早上生成当日推荐。
     * 以最新期号为准，用户已有该期推荐则跳过，避免同一期重复生成污染样本。
     * 放在第二天而不是当晚：用户早上打开工具就能看到当晚开奖的预测，信息更有时效性。
     */
    @Scheduled(cron = "0 0 8 * * *")
    public void autoRecommendDaily() {
        LotteryKl8Draw latest = latestDraw();
        if (latest == null) {
            log.info("快乐8自动推荐跳过：暂无开奖数据");
            return;
        }
        List<AppUser> users = appUserMapper.selectList(Wrappers.<AppUser>lambdaQuery()
                .eq(AppUser::getStatus, "ACTIVE"));
        int generated = 0;
        for (AppUser user : users) {
            if (hasRecommendationForIssue(user.getId(), latest.getIssueNo())) {
                continue;
            }
            try {
                recommendationService.recommend(user.getId(), new LotteryKl8RecommendationRequest(null));
                generated += 1;
            } catch (Exception e) {
                log.warn("快乐8自动推荐失败: userId={}, error={}", user.getId(), e.getMessage());
            }
        }
        log.info("快乐8自动推荐完成: 用户 {} 个, 生成 {} 条（基准期 {}）", users.size(), generated, latest.getIssueNo());
    }

    private LotteryKl8Draw latestDraw() {
        return drawMapper.selectOne(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT 1"));
    }

    private boolean hasRecommendationForIssue(Long userId, String issueNo) {
        return recommendationMapper.selectCount(Wrappers.<LotteryKl8Recommendation>lambdaQuery()
                .eq(LotteryKl8Recommendation::getUserId, userId)
                .eq(LotteryKl8Recommendation::getLatestIssueNo, issueNo)) > 0;
    }
}
