package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.SsqDrawVO;
import com.lcbinterview.dto.tools.SsqSyncResultVO;
import com.lcbinterview.dto.tools.SsqSyncStatusVO;
import com.lcbinterview.mapper.SsqDrawMapper;
import com.lcbinterview.model.SsqDraw;
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
 * 双色球开奖同步服务：每周二四日定时抓取公开开奖数据，抓取后自动结算推荐命中。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SsqSyncService {

    private final SsqDrawMapper drawMapper;
    private final ZhcwSsqDrawFetcher drawFetcher;
    private final SsqRecommendationEvaluationService evaluationService;

    private volatile LocalDateTime lastSyncAt;

    /**
     * 每周二四日 21:30 定时同步（双色球 21:15 开奖）。
     */
    @Scheduled(cron = "0 30 21 * * TUE,THU,SUN")
    public void scheduledSync() {
        try {
            sync();
        } catch (Exception e) {
            log.warn("双色球定时同步失败: {}", e.getMessage());
        }
    }

    /**
     * 手动同步双色球开奖数据，并结算待评估推荐。
     *
     * @return 同步结果
     */
    @Transactional
    public SsqSyncResultVO sync() {
        List<ZhcwSsqDrawFetcher.SsqFetchedDraw> fetched = drawFetcher.fetchRecentDraws();
        Set<String> existingIssueNos = existingIssueNos(fetched);
        int inserted = 0;
        for (ZhcwSsqDrawFetcher.SsqFetchedDraw draw : fetched) {
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
            log.info("双色球同步后完成推荐命中结算 {} 条", evaluated);
        }
        SsqDraw latest = latestDraw();
        String latestIssue = latest == null ? "" : latest.getIssueNo();
        return new SsqSyncResultVO(true, fetched.size(), inserted, latestIssue, evaluated, "同步完成");
    }

    /**
     * 查询双色球同步状态。
     *
     * @return 同步状态
     */
    @Transactional(readOnly = true)
    public SsqSyncStatusVO status() {
        SsqDraw latest = latestDraw();
        Long count = drawMapper.selectCount(Wrappers.<SsqDraw>lambdaQuery());
        boolean stale = latest == null || latest.getDrawDate().isBefore(LocalDate.now().minusDays(4));
        return new SsqSyncStatusVO(
                latest == null ? "" : latest.getIssueNo(),
                latest == null ? null : latest.getDrawDate(),
                count == null ? 0 : count,
                lastSyncAt,
                stale,
                stale ? "开奖数据可能需要同步" : "开奖数据已缓存");
    }

    /**
     * 分页查询近期双色球开奖。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 开奖分页
     */
    @Transactional(readOnly = true)
    public PageResult<SsqDrawVO> listDraws(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        Page<SsqDraw> result = drawMapper.selectPage(new Page<>(safePage + 1L, safeSize),
                Wrappers.<SsqDraw>lambdaQuery()
                        .orderByDesc(SsqDraw::getIssueNo));
        List<SsqDrawVO> content = result.getRecords().stream()
                .map(draw -> new SsqDrawVO(draw.getIssueNo(), draw.getDrawDate(),
                        parseNumbers(draw.getRedNumbers()), parseBlue(draw.getBlueNumber())))
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
        SsqDraw latest = latestDraw();
        return latest == null ? "" : latest.getIssueNo();
    }

    private SsqDraw latestDraw() {
        return drawMapper.selectOne(Wrappers.<SsqDraw>lambdaQuery()
                .orderByDesc(SsqDraw::getIssueNo)
                .last("LIMIT 1"));
    }

    private Set<String> existingIssueNos(List<ZhcwSsqDrawFetcher.SsqFetchedDraw> fetched) {
        if (fetched.isEmpty()) {
            return Set.of();
        }
        List<String> issueNos = fetched.stream()
                .map(ZhcwSsqDrawFetcher.SsqFetchedDraw::issueNo)
                .toList();
        return drawMapper.selectList(Wrappers.<SsqDraw>lambdaQuery()
                        .in(SsqDraw::getIssueNo, issueNos))
                .stream()
                .map(SsqDraw::getIssueNo)
                .collect(Collectors.toSet());
    }

    private SsqDraw toEntity(ZhcwSsqDrawFetcher.SsqFetchedDraw draw) {
        SsqDraw entity = new SsqDraw();
        entity.setIssueNo(draw.issueNo());
        entity.setDrawDate(draw.drawDate());
        entity.setRedNumbers(draw.redNumbers().stream().map(String::valueOf).collect(Collectors.joining(",")));
        entity.setBlueNumber(String.valueOf(draw.blueNumber()));
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

    private Integer parseBlue(String value) {
        try {
            return value == null ? null : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
