package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.dto.tools.LotteryKl8RecommendationRequest;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.LotteryKl8Draw;
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
    private final LotteryKl8RecommendationService recommendationService;

    /**
     * 每天 22:35 执行：22:30 已同步并结算，紧随其后生成次日推荐（快乐8 每天一期）。
     * 以最新期号为准，用户已有同口径（选4 + 当前策略版本）推荐则跳过，
     * 口径升级后同期旧记录会被重新生成，避免用户一直看到旧玩法。
     *
     * @return 本次实际生成的推荐条数
     */
    @Scheduled(cron = "0 35 22 * * *")
    public int autoRecommendDaily() {
        LotteryKl8Draw latest = latestDraw();
        if (latest == null) {
            log.info("快乐8自动推荐跳过：暂无开奖数据");
            return 0;
        }
        List<AppUser> users = appUserMapper.selectList(Wrappers.<AppUser>lambdaQuery()
                .eq(AppUser::getStatus, "ACTIVE"));
        int generated = 0;
        for (AppUser user : users) {
            if (recommendationService.hasCurrentRecommendation(user.getId(), latest.getIssueNo())) {
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
        return generated;
    }

    private LotteryKl8Draw latestDraw() {
        return drawMapper.selectOne(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT 1"));
    }
}
