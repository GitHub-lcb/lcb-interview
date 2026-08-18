package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.mapper.DltRecommendationMapper;
import com.lcbinterview.model.AppUser;
import com.lcbinterview.model.DltDraw;
import com.lcbinterview.model.DltRecommendation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

/**
 * 大乐透自动推荐调度器：开奖日当天早上为活跃用户生成推荐（预测当晚开奖）。
 * 每周一三六开奖，非开奖日跳过；同一期不重复生成。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DltAutoRecommendationScheduler {

    private static final List<DayOfWeek> DRAW_DAYS = List.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.SATURDAY);

    private final AppUserMapper appUserMapper;
    private final DltDrawMapper drawMapper;
    private final DltRecommendationMapper recommendationMapper;
    private final DltRecommendationService recommendationService;

    /**
     * 每天 21:35 执行（仅开奖日周一/三/六）：21:30 已同步并结算，紧随其后生成当日推荐。
     * 同一期不重复生成，避免污染样本。
     */
    @Scheduled(cron = "0 35 21 * * MON,WED,SAT")
    public void autoRecommendDaily() {
        if (!isDrawDay(LocalDate.now())) {
            return;
        }
        recommendForLatestDraw();
    }

    /**
     * 是否为开奖日。
     *
     * @param date 日期
     * @return 是否开奖日
     */
    static boolean isDrawDay(LocalDate date) {
        return DRAW_DAYS.contains(date.getDayOfWeek());
    }

    /**
     * 为所有活跃用户生成基于最新已开奖期的推荐（不含开奖日判断，供测试直接调用）。
     */
    void recommendForLatestDraw() {
        DltDraw latest = latestDraw();
        if (latest == null) {
            log.info("大乐透自动推荐跳过：暂无开奖数据");
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
                recommendationService.recommend(user.getId(), null);
                generated += 1;
            } catch (Exception e) {
                log.warn("大乐透自动推荐失败: userId={}, error={}", user.getId(), e.getMessage());
            }
        }
        log.info("大乐透自动推荐完成: 用户 {} 个, 生成 {} 条（基准期 {}）", users.size(), generated, latest.getIssueNo());
    }

    private DltDraw latestDraw() {
        return drawMapper.selectOne(Wrappers.<DltDraw>lambdaQuery()
                .orderByDesc(DltDraw::getIssueNo)
                .last("LIMIT 1"));
    }

    private boolean hasRecommendationForIssue(Long userId, String issueNo) {
        return recommendationMapper.selectCount(Wrappers.<DltRecommendation>lambdaQuery()
                .eq(DltRecommendation::getUserId, userId)
                .eq(DltRecommendation::getLatestIssueNo, issueNo)) > 0;
    }
}
