package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.DltDrawVO;
import com.lcbinterview.dto.tools.DltSyncResultVO;
import com.lcbinterview.dto.tools.DltSyncStatusVO;
import com.lcbinterview.mapper.DltDrawMapper;
import com.lcbinterview.model.DltDraw;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 大乐透开奖同步服务：每周一三六定时抓取公开开奖数据，抓取后自动结算推荐命中。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DltSyncService {

    private final DltDrawMapper drawMapper;
    private final ZhcwDltDrawFetcher drawFetcher;
    private final DltRecommendationEvaluationService evaluationService;

    private volatile LocalDateTime lastSyncAt;

    /**
     * 每周一三六 21:30 定时同步（大乐透 21:25 开奖）。
     */
    @Scheduled(cron = "0 30 21 * * MON,WED,SAT")
    public void scheduledSync() {
        try {
            sync();
        } catch (Exception e) {
            log.warn("大乐透定时同步失败: {}", e.getMessage());
        }
    }

    /**
     * 手动同步大乐透开奖数据，并结算待评估推荐。
     *
     * @return 同步结果
     */
    @Transactional
    public DltSyncResultVO sync() {
        List<ZhcwDltDrawFetcher.DltFetchedDraw> fetched = drawFetcher.fetchRecentDraws();
        Set<String> existingIssueNos = existingIssueNos(fetched);
        int inserted = 0;
        for (ZhcwDltDrawFetcher.DltFetchedDraw draw : fetched) {
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
            log.info("大乐透同步后完成推荐命中结算 {} 条", evaluated);
        }
        DltDraw latest = latestDraw();
        String latestIssue = latest == null ? "" : latest.getIssueNo();
        return new DltSyncResultVO(true, fetched.size(), inserted, latestIssue, evaluated, "同步完成");
    }

    /**
     * 查询大乐透同步状态。
     *
     * @return 同步状态
     */
    @Transactional(readOnly = true)
    public DltSyncStatusVO status() {
        DltDraw latest = latestDraw();
        Long count = drawMapper.selectCount(Wrappers.<DltDraw>lambdaQuery());
        boolean stale = latest == null || latest.getDrawDate().isBefore(LocalDate.now().minusDays(4));
        return new DltSyncStatusVO(
                latest == null ? "" : latest.getIssueNo(),
                latest == null ? null : latest.getDrawDate(),
                count == null ? 0 : count,
                lastSyncAt,
                stale,
                stale ? "开奖数据可能需要同步" : "开奖数据已缓存");
    }

    /**
     * 分页查询近期大乐透开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 开奖分页
     */
    @Transactional(readOnly = true)
    public PageResult<DltDrawVO> listDraws(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        Page<DltDraw> result = drawMapper.selectPage(new Page<>(safePage + 1L, safeSize),
                Wrappers.<DltDraw>lambdaQuery()
                        .orderByDesc(DltDraw::getIssueNo));
        List<DltDrawVO> content = result.getRecords().stream()
                .map(draw -> new DltDrawVO(draw.getIssueNo(), draw.getDrawDate(),
                        parseNumbers(draw.getFrontNumbers()), parseNumbers(draw.getBackNumbers())))
                .toList();
        return PageResult.of(result, content);
    }

    /**
     * 查询最新一期开奖期号。
     *
     * @return 最新期号，无数据时为空字符串
     */
    @Transactional(readOnly = true)
    public String latestIssueNo() {
        DltDraw latest = latestDraw();
        return latest == null ? "" : latest.getIssueNo();
    }

    private DltDraw latestDraw() {
        return drawMapper.selectOne(Wrappers.<DltDraw>lambdaQuery()
                .orderByDesc(DltDraw::getIssueNo)
                .last("LIMIT 1"));
    }

    private Set<String> existingIssueNos(List<ZhcwDltDrawFetcher.DltFetchedDraw> fetched) {
        if (fetched.isEmpty()) {
            return Set.of();
        }
        List<String> issueNos = fetched.stream()
                .map(ZhcwDltDrawFetcher.DltFetchedDraw::issueNo)
                .toList();
        return drawMapper.selectList(Wrappers.<DltDraw>lambdaQuery()
                        .in(DltDraw::getIssueNo, issueNos))
                .stream()
                .map(DltDraw::getIssueNo)
                .collect(Collectors.toSet());
    }

    private DltDraw toEntity(ZhcwDltDrawFetcher.DltFetchedDraw draw) {
        DltDraw entity = new DltDraw();
        entity.setIssueNo(draw.issueNo());
        entity.setDrawDate(draw.drawDate());
        entity.setFrontNumbers(draw.frontNumbers().stream().map(String::valueOf).collect(Collectors.joining(",")));
        entity.setBackNumbers(draw.backNumbers().stream().map(String::valueOf).collect(Collectors.joining(",")));
        entity.setSourceUrl(draw.sourceUrl());
        entity.setSourceName(draw.sourceName());
        return entity;
    }

    private List<Integer> parseNumbers(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<Integer> numbers = new ArrayList<>();
        for (String part : value.split(",")) {
            try {
                numbers.add(Integer.parseInt(part.trim()));
            } catch (NumberFormatException ignored) {
                // 忽略脏数据，由上层数量校验兜底
            }
        }
        return numbers;
    }
}
