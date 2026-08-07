package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.mapper.InterviewSourceMapper;
import com.lcbinterview.mapper.KnowledgePointMapper;
import com.lcbinterview.mapper.KnowledgePointMentionMapper;
import com.lcbinterview.mapper.QuestionKnowledgePointMapper;
import com.lcbinterview.mapper.QuestionTagMapper;
import com.lcbinterview.mapper.TagMapper;
import com.lcbinterview.model.InterviewSource;
import com.lcbinterview.model.KnowledgePoint;
import com.lcbinterview.model.KnowledgePointMention;
import com.lcbinterview.model.Question;
import com.lcbinterview.model.QuestionTag;
import com.lcbinterview.model.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 考点管道持久化服务，为每个 AI 批次提供独立事务和并发安全的幂等写入。
 */
@Service
@RequiredArgsConstructor
public class KnowledgePointPersistenceService {

    private final KnowledgePointMapper knowledgePointMapper;
    private final KnowledgePointMentionMapper knowledgePointMentionMapper;
    private final QuestionKnowledgePointMapper questionKnowledgePointMapper;
    private final QuestionTagMapper questionTagMapper;
    private final TagMapper tagMapper;
    private final InterviewSourceMapper interviewSourceMapper;

    /**
     * 在一个事务中写入题目考点和补充标签。
     *
     * @param batch            当前题目批次
     * @param pointsByQuestion AI 提取的题目考点
     * @param categoryNames    分类 ID 到名称映射
     * @return 本批写入统计
     */
    @Transactional
    public CleaningWriteResult persistCleaningBatch(List<Question> batch,
                                                     Map<Long, List<String>> pointsByQuestion,
                                                     Map<Long, String> categoryNames) {
        // 在同一事务内替换 AI 关联；失败回滚时旧关联恢复，人工关联不会被删除。
        questionKnowledgePointMapper.deleteAiByQuestionIds(batch.stream().map(Question::getId).toList());
        Map<String, Long> tagIdByName = new HashMap<>();
        for (Tag tag : tagMapper.selectList(Wrappers.<Tag>lambdaQuery())) {
            tagIdByName.put(tag.getName(), tag.getId());
        }

        Map<String, KnowledgePoint> pointCache = new HashMap<>();
        int newPoints = 0;
        int taggedQuestions = 0;
        for (Question question : batch) {
            List<String> names = new LinkedHashSet<>(pointsByQuestion.getOrDefault(question.getId(), List.of()))
                    .stream().toList();
            boolean hadTags = questionTagMapper.selectCount(Wrappers.<QuestionTag>lambdaQuery()
                    .eq(QuestionTag::getQuestionId, question.getId())) > 0;
            boolean insertedTag = false;
            for (String rawName : names) {
                String name = normalizeName(rawName);
                String key = question.getCategoryId() + ":" + name;
                KnowledgePoint point = pointCache.get(key);
                if (point == null) {
                    PointResolution resolution = resolvePoint(question.getCategoryId(), name);
                    point = resolution.point();
                    pointCache.put(key, point);
                    if (resolution.created()) {
                        newPoints += 1;
                    }
                }
                questionKnowledgePointMapper.insertIgnore(question.getId(), point.getId());
                if (!hadTags) {
                    Long tagId = tagIdByName.get(name);
                    if (tagId != null && questionTagMapper.insertIgnore(question.getId(), tagId) > 0) {
                        insertedTag = true;
                    }
                }
            }
            if (!hadTags && !names.isEmpty()) {
                Long categoryTagId = tagIdByName.get(categoryNames.get(question.getCategoryId()));
                if (categoryTagId != null && questionTagMapper.insertIgnore(question.getId(), categoryTagId) > 0) {
                    insertedTag = true;
                }
            }
            if (insertedTag) {
                taggedQuestions += 1;
            }
        }
        return new CleaningWriteResult(newPoints, taggedQuestions);
    }

    /**
     * 在一个事务中写入语料考点提及，并仅在全部写入成功后推进语料状态。
     *
     * @param sources     当前语料批次
     * @param extractions 已校验的 AI 提取结果
     * @return 本批写入统计
     */
    @Transactional
    public CorpusWriteResult persistCorpusBatch(List<InterviewSource> sources,
                                                 List<CorpusSourceWrite> extractions) {
        Map<String, KnowledgePoint> pointCache = new HashMap<>();
        int newPoints = 0;
        int newMentions = 0;
        Map<Long, CorpusSourceWrite> bySource = new HashMap<>();
        for (CorpusSourceWrite extraction : extractions) {
            bySource.put(extraction.sourceId(), extraction);
            for (CorpusMentionWrite draft : extraction.mentions()) {
                String key = draft.categoryId() + ":" + draft.pointName();
                KnowledgePoint point = pointCache.get(key);
                if (point == null) {
                    PointResolution resolution = resolvePoint(draft.categoryId(), draft.pointName());
                    point = resolution.point();
                    pointCache.put(key, point);
                    if (resolution.created()) {
                        newPoints += 1;
                    }
                }
                KnowledgePointMention mention = new KnowledgePointMention();
                mention.setInterviewSourceId(extraction.sourceId());
                mention.setKnowledgePointId(point.getId());
                mention.setMentionCount(draft.mentionCount());
                mention.setContext(draft.context());
                if (knowledgePointMentionMapper.upsertMention(mention) == 1) {
                    newMentions += 1;
                }
            }
        }
        for (InterviewSource source : sources) {
            CorpusSourceWrite extraction = bySource.get(source.getId());
            if (interviewSourceMapper.markExtracted(source.getId(), extraction.company(), extraction.position()) != 1) {
                throw new IllegalStateException("语料状态已变化，拒绝覆盖: " + source.getId());
            }
        }
        return new CorpusWriteResult(newPoints, newMentions);
    }

    /**
     * 在独立事务中把仍为 RAW 的语料标记为失败。
     *
     * @param sources 当前语料批次
     * @param error   失败原因
     */
    @Transactional
    public void markCorpusBatchFailed(List<InterviewSource> sources, String error) {
        String safeError = error == null || error.isBlank() ? "未知提取错误" : error;
        if (safeError.length() > 500) {
            safeError = safeError.substring(0, 500);
        }
        for (InterviewSource source : sources) {
            interviewSourceMapper.markFailed(source.getId(), safeError);
        }
    }

    private PointResolution resolvePoint(Long categoryId, String name) {
        KnowledgePoint point = new KnowledgePoint();
        point.setCategoryId(categoryId);
        point.setName(name);
        point.setSlug("kp-" + UUID.randomUUID());
        point.setHotScore(0);
        point.setHotScoreSource("CORPUS");
        point.setStatus("DRAFT");
        point.setDescription("");
        int affected = knowledgePointMapper.upsertPoint(point);
        if (point.getId() == null) {
            point = knowledgePointMapper.selectByCategoryAndName(categoryId, name);
        }
        if (point == null || point.getId() == null) {
            throw new IllegalStateException("考点写入后无法读取主键: " + categoryId + ":" + name);
        }
        return new PointResolution(point, affected == 1);
    }

    static String normalizeName(String name) {
        String clean = name == null ? "" : name.trim().replaceAll("\\s+", "");
        if (clean.isEmpty() || clean.length() > 80) {
            throw new IllegalArgumentException("考点名长度必须为 1-80: " + clean);
        }
        return clean;
    }

    private record PointResolution(KnowledgePoint point, boolean created) {
    }

    /**
     * 题目清洗批次写入统计。
     *
     * @param newKnowledgePoints 新增考点数
     * @param taggedQuestions    新增标签的题目数
     */
    public record CleaningWriteResult(int newKnowledgePoints, int taggedQuestions) {
    }

    /**
     * 语料批次写入统计。
     *
     * @param newKnowledgePoints 新增考点数
     * @param newMentions        新增提及数
     */
    public record CorpusWriteResult(int newKnowledgePoints, int newMentions) {
    }

    /**
     * 单篇语料的已校验提取结果。
     *
     * @param sourceId 语料 ID
     * @param company  公司
     * @param position 岗位
     * @param mentions 考点提及
     */
    public record CorpusSourceWrite(long sourceId, String company, String position,
                                    List<CorpusMentionWrite> mentions) {
    }

    /**
     * 单个考点提及写入数据。
     *
     * @param categoryId  分类 ID
     * @param pointName   规范化考点名
     * @param mentionCount 提及次数
     * @param context      提及上下文
     */
    public record CorpusMentionWrite(long categoryId, String pointName, int mentionCount, String context) {
    }
}
