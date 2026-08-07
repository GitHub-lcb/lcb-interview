package com.lcbinterview.service;

import com.lcbinterview.mapper.InterviewFeedbackMapper;
import com.lcbinterview.mapper.KnowledgePointMapper;
import com.lcbinterview.mapper.KnowledgePointMentionMapper;
import com.lcbinterview.mapper.QuestionKnowledgePointMapper;
import com.lcbinterview.model.KnowledgePoint;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 高频权重计算服务：语料提及频次（60%）+ 覆盖篇数先验（25%）+ 题目覆盖度（15%）
 * 归一化为 0-100 的 hot_score；用户面试回填充足后与语料权重渐变融合。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgePointWeightService {

    /** 语料频次占比 */
    private static final double MENTION_WEIGHT = 0.60;
    /** 覆盖篇数先验占比（篇数越多说明跨场景被问越普遍） */
    private static final double DOCS_WEIGHT = 0.25;
    /** 题目覆盖度占比（考点下题目越多说明题库供给越充分） */
    private static final double QUESTIONS_WEIGHT = 0.15;
    /** 反馈融合比例上限：样本充足时反馈最多占 60% */
    private static final double MAX_FEEDBACK_RATIO = 0.60;
    /** 反馈融合比例下限：样本不足时反馈占 20% */
    private static final double MIN_FEEDBACK_RATIO = 0.20;
    /** 反馈样本达到该数量时融合比例到上限 */
    private static final double FEEDBACK_SATURATION = 500;

    private final KnowledgePointMapper knowledgePointMapper;
    private final KnowledgePointMentionMapper knowledgePointMentionMapper;
    private final QuestionKnowledgePointMapper questionKnowledgePointMapper;
    private final InterviewFeedbackMapper interviewFeedbackMapper;

    /**
     * 重算全量考点高频权重，返回更新条数。
     * 用户反馈样本越多，反馈在权重中的占比越高（20% 渐变到 60%）。
     * 内存策略：提及/关联/回填全部走 SQL 聚合，只返回考点数级别的聚合行，
     * 避免全量加载明细数据导致内存随语料和回填量线性增长。
     *
     * @return 更新条数
     */
    @Transactional
    public int recalculate() {
        List<Long> pointIds = knowledgePointMapper.selectAllIds();
        if (pointIds.isEmpty()) {
            return 0;
        }

        // 语料频次与覆盖篇数：SQL 聚合，每考点一行
        Map<Long, Long> mentionTotal = new HashMap<>();
        Map<Long, Long> docCount = new HashMap<>();
        for (KnowledgePointMentionMapper.MentionStat stat : knowledgePointMentionMapper.selectMentionStats()) {
            if (stat.kpId() != null && stat.total() != null && stat.docs() != null) {
                mentionTotal.put(stat.kpId(), stat.total());
                docCount.put(stat.kpId(), stat.docs());
            }
        }

        // 题目覆盖度：SQL 聚合
        Map<Long, Long> questionCount = new HashMap<>();
        for (QuestionKnowledgePointMapper.IdCount row : questionKnowledgePointMapper.selectRelationCounts()) {
            if (row.kpId() != null && row.total() != null) {
                questionCount.put(row.kpId(), row.total());
            }
        }

        // 用户回填频次：SQL 聚合
        Map<Long, Long> feedbackCount = new HashMap<>();
        for (InterviewFeedbackMapper.IdCount row : interviewFeedbackMapper.selectFeedbackCounts()) {
            if (row.kpId() != null && row.total() != null) {
                feedbackCount.put(row.kpId(), row.total());
            }
        }
        long totalFeedback = feedbackCount.values().stream().mapToLong(Long::longValue).sum();

        long maxMention = mentionTotal.values().stream().mapToLong(Long::longValue).max().orElse(1);
        long maxDocs = docCount.values().stream().mapToLong(Long::longValue).max().orElse(1);
        long maxQuestions = questionCount.values().stream().mapToLong(Long::longValue).max().orElse(1);
        long maxFeedback = feedbackCount.values().stream().mapToLong(Long::longValue).max().orElse(1);

        // 反馈融合比例：样本越多占比越高，20% 渐变到 60%
        double feedbackRatio = totalFeedback >= FEEDBACK_SATURATION
                ? MAX_FEEDBACK_RATIO
                : MIN_FEEDBACK_RATIO + (MAX_FEEDBACK_RATIO - MIN_FEEDBACK_RATIO) * totalFeedback / FEEDBACK_SATURATION;

        int updated = 0;
        for (Long pointId : pointIds) {
            double mentionScore = maxMention == 0 ? 0 : (double) mentionTotal.getOrDefault(pointId, 0L) / maxMention;
            double docsScore = maxDocs == 0 ? 0 : (double) docCount.getOrDefault(pointId, 0L) / maxDocs;
            double questionScore = maxQuestions == 0 ? 0 : (double) questionCount.getOrDefault(pointId, 0L) / maxQuestions;
            double corpusScore = mentionScore * MENTION_WEIGHT + docsScore * DOCS_WEIGHT + questionScore * QUESTIONS_WEIGHT;

            int rawScore;
            String source;
            long feedback = feedbackCount.getOrDefault(pointId, 0L);
            if (feedback > 0) {
                // 反馈与语料融合：反馈占比随样本量上升，样本不足时以语料为主
                double feedbackScore = (double) feedback / maxFeedback;
                rawScore = (int) Math.round((1 - feedbackRatio) * corpusScore * 100 + feedbackRatio * feedbackScore * 100);
                source = "BLEND";
            } else {
                rawScore = (int) Math.round(corpusScore * 100);
                source = "CORPUS";
            }

            KnowledgePoint update = new KnowledgePoint();
            update.setId(pointId);
            update.setHotScore(Math.max(0, Math.min(100, rawScore)));
            update.setHotScoreSource(source);
            knowledgePointMapper.updateById(update);
            updated += 1;
        }
        log.info("考点权重重算完成: {} 个考点, 反馈样本 {} 条, 反馈融合占比 {}", updated, totalFeedback,
                String.format("%.0f%%", feedbackRatio * 100));
        return updated;
    }

    /**
     * 每日凌晨自动重算一次考点权重，让语料与用户回填持续进化。
     */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void scheduledRecalculate() {
        recalculate();
    }
}
