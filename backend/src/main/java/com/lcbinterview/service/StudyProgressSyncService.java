package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.StudyProgressSnapshotMapper;
import com.lcbinterview.model.StudyProgressSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 学习进度云同步服务。负责把前端 localStorage 的学习进度 JSON 快照
 * 整体落库和回读，服务端不解析进度内部结构，只做容量保护。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudyProgressSyncService {

    /** 快照 JSON 最大 2MB，防止异常客户端把 MEDIUMTEXT 撑爆或拖垮同步接口 */
    private static final int MAX_JSON_LENGTH = 2 * 1024 * 1024;

    private final StudyProgressSnapshotMapper studyProgressSnapshotMapper;

    /**
     * 保存（upsert）当前用户的学习进度快照。按 user_id 查询，
     * 已存在则覆盖更新，不存在则插入，保证一人仅一份最新快照。
     *
     * @param userId         用户 ID
     * @param progressJson   学习进度 JSON 快照
     * @param clientUpdatedAt 客户端进度更新时间 ISO 字符串，可为空
     */
    @Transactional
    public void save(Long userId, String progressJson, String clientUpdatedAt) {
        if (!StringUtils.hasText(progressJson)) {
            throw new BusinessException(400, "学习进度内容不能为空");
        }
        // 前端进度对象理论只有几十 KB，超过 2MB 视为异常 payload，直接拒绝避免存储被滥用
        if (progressJson.length() > MAX_JSON_LENGTH) {
            throw new BusinessException(400, "学习进度内容超过 2MB 上限");
        }
        StudyProgressSnapshot existing = selectByUserId(userId);
        if (existing == null) {
            StudyProgressSnapshot snapshot = new StudyProgressSnapshot();
            snapshot.setUserId(userId);
            snapshot.setProgressJson(progressJson);
            snapshot.setClientUpdatedAt(normalizeClientUpdatedAt(clientUpdatedAt));
            studyProgressSnapshotMapper.insert(snapshot);
        } else {
            existing.setProgressJson(progressJson);
            existing.setClientUpdatedAt(normalizeClientUpdatedAt(clientUpdatedAt));
            studyProgressSnapshotMapper.updateById(existing);
        }
        log.info("用户 {} 学习进度快照已同步，大小 {} 字符", userId, progressJson.length());
    }

    /**
     * 读取当前用户最新的学习进度快照。
     *
     * @param userId 用户 ID
     * @return 最新快照，用户从未同步过时返回 null
     */
    @Transactional(readOnly = true)
    public StudyProgressSnapshot load(Long userId) {
        return selectByUserId(userId);
    }

    private StudyProgressSnapshot selectByUserId(Long userId) {
        // user_id 有唯一约束，selectOne 最多命中一条；逻辑删除条件由 MyBatis-Plus 自动追加
        return studyProgressSnapshotMapper.selectOne(
                Wrappers.<StudyProgressSnapshot>lambdaQuery()
                        .eq(StudyProgressSnapshot::getUserId, userId)
                        .orderByDesc(StudyProgressSnapshot::getUpdateTime)
                        .last("LIMIT 1"));
    }

    private String normalizeClientUpdatedAt(String clientUpdatedAt) {
        if (!StringUtils.hasText(clientUpdatedAt)) {
            return "";
        }
        return clientUpdatedAt.trim();
    }
}
