package com.lcbinterview.dto;

import com.lcbinterview.model.StudyProgressSnapshot;

import java.time.format.DateTimeFormatter;

/**
 * 学习进度快照展示对象。
 *
 * @param progressJson 学习进度 JSON 快照，用户从未同步过时为 null
 * @param updatedAt    快照更新时间：优先返回客户端上报的 ISO 时间，缺失时回退服务端更新时间
 */
public record StudyProgressVO(
        String progressJson,
        String updatedAt
) {

    /** ISO 时间格式，与前端 localStorage 记录的进度时间格式保持一致 */
    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /**
     * 从快照实体创建展示对象。
     *
     * @param snapshot 学习进度快照实体，可为 null
     * @return 展示对象；快照为 null 时返回 progressJson 为 null 的空对象
     */
    public static StudyProgressVO from(StudyProgressSnapshot snapshot) {
        if (snapshot == null) {
            return new StudyProgressVO(null, null);
        }
        // 客户端时间更贴近用户真实操作进度，服务端时间仅作兜底展示
        if (snapshot.getClientUpdatedAt() != null && !snapshot.getClientUpdatedAt().isBlank()) {
            return new StudyProgressVO(snapshot.getProgressJson(), snapshot.getClientUpdatedAt());
        }
        String serverTime = snapshot.getUpdateTime() == null
                ? null
                : ISO_FORMATTER.format(snapshot.getUpdateTime());
        return new StudyProgressVO(snapshot.getProgressJson(), serverTime);
    }
}
