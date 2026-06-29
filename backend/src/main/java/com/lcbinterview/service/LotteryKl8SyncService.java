package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.LotteryKl8DrawVO;
import com.lcbinterview.dto.tools.LotteryKl8SyncResultVO;
import com.lcbinterview.dto.tools.LotteryKl8SyncStatusVO;
import com.lcbinterview.mapper.LotteryKl8DrawMapper;
import com.lcbinterview.model.LotteryKl8Draw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 快乐8开奖同步服务，负责手动和定时抓取公开开奖数据。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LotteryKl8SyncService {

    private final LotteryKl8DrawMapper drawMapper;
    private final LotteryKl8DrawFetcher drawFetcher;
    private final LotteryKl8RecommendationEvaluationService evaluationService;

    private volatile LocalDateTime lastSyncAt;

    /**
     * 每天定时同步一次公开开奖数据。
     */
    @Scheduled(cron = "0 30 22 * * *")
    public void scheduledSync() {
        try {
            sync();
        } catch (Exception e) {
            log.warn("快乐8定时同步失败: {}", e.getMessage());
        }
    }

    /**
     * 手动同步快乐8开奖数据。
     *
     * @return 同步结果
     */
    @Transactional
    public LotteryKl8SyncResultVO sync() {
        List<LotteryKl8FetchedDraw> fetched = drawFetcher.fetchRecentDraws();
        Set<String> existingIssueNos = existingIssueNos(fetched);
        int inserted = 0;
        for (LotteryKl8FetchedDraw draw : fetched) {
            if (existingIssueNos.contains(draw.issueNo())) {
                continue;
            }
            drawMapper.insert(toEntity(draw));
            existingIssueNos.add(draw.issueNo());
            inserted += 1;
        }
        lastSyncAt = LocalDateTime.now();
        int evaluated = evaluationService.evaluatePendingRecommendations();
        if (evaluated > 0) {
            log.info("快乐8同步后完成推荐命中结算 {} 条", evaluated);
        }
        LotteryKl8Draw latest = latestDraw();
        String latestIssue = latest == null ? "" : latest.getIssueNo();
        return new LotteryKl8SyncResultVO(true, sourceName(fetched), fetched.size(), inserted, latestIssue, "同步完成");
    }

    /**
     * 查询开奖同步状态。
     *
     * @return 同步状态
     */
    @Transactional(readOnly = true)
    public LotteryKl8SyncStatusVO status() {
        LotteryKl8Draw latest = latestDraw();
        Long count = drawMapper.selectCount(Wrappers.<LotteryKl8Draw>lambdaQuery());
        boolean stale = latest == null || latest.getDrawDate().isBefore(LocalDate.now().minusDays(2));
        return new LotteryKl8SyncStatusVO(
                latest == null ? "" : latest.getIssueNo(),
                latest == null ? null : latest.getDrawDate(),
                count == null ? 0 : count,
                lastSyncAt,
                stale,
                stale ? "开奖数据可能需要同步" : "开奖数据已缓存");
    }

    /**
     * 分页查询近期开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 分页开奖记录
     */
    @Transactional(readOnly = true)
    public PageResult<LotteryKl8DrawVO> listDraws(int page, int size) {
        Page<LotteryKl8Draw> request = new Page<>(Math.max(0, page) + 1L, Math.min(100, Math.max(1, size)));
        Page<LotteryKl8Draw> result = drawMapper.selectPage(request, Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getDrawDate)
                .orderByDesc(LotteryKl8Draw::getIssueNo));
        return PageResult.of(result, result.getRecords().stream().map(LotteryKl8DrawVO::from).toList());
    }

    private Set<String> existingIssueNos(List<LotteryKl8FetchedDraw> fetched) {
        if (fetched.isEmpty()) {
            return new java.util.HashSet<>();
        }
        List<String> issueNos = fetched.stream()
                .map(LotteryKl8FetchedDraw::issueNo)
                .distinct()
                .toList();
        // 全量历史同步可能一次返回上千期，先批量查重，避免逐期 selectCount 导致接口超时。
        return drawMapper.selectList(Wrappers.<LotteryKl8Draw>lambdaQuery()
                        .in(LotteryKl8Draw::getIssueNo, issueNos))
                .stream()
                .map(LotteryKl8Draw::getIssueNo)
                .collect(Collectors.toSet());
    }

    private LotteryKl8Draw latestDraw() {
        return drawMapper.selectOne(Wrappers.<LotteryKl8Draw>lambdaQuery()
                .orderByDesc(LotteryKl8Draw::getDrawDate)
                .orderByDesc(LotteryKl8Draw::getIssueNo)
                .last("LIMIT 1"));
    }

    private LotteryKl8Draw toEntity(LotteryKl8FetchedDraw fetched) {
        LotteryKl8Draw draw = new LotteryKl8Draw();
        draw.setIssueNo(fetched.issueNo());
        draw.setDrawDate(fetched.drawDate());
        draw.setNumbers(joinNumbers(fetched.numbers()));
        draw.setSourceUrl(fetched.sourceUrl());
        draw.setSourceName(fetched.sourceName());
        return draw;
    }

    private String joinNumbers(List<Integer> numbers) {
        return numbers.stream().map(String::valueOf).reduce((left, right) -> left + "," + right).orElse("");
    }

    private String sourceName(List<LotteryKl8FetchedDraw> fetched) {
        return fetched.isEmpty() ? "公开开奖页面" : fetched.get(0).sourceName();
    }
}
