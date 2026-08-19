package com.lcbinterview.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 学习进度同步请求。
 *
 * @param progressJson    学习进度 JSON 快照，前端 localStorage 进度对象整体序列化
 * @param clientUpdatedAt 客户端进度更新时间 ISO 字符串，可选
 */
public record StudyProgressSyncRequest(
        @NotBlank(message = "学习进度内容不能为空") String progressJson,
        String clientUpdatedAt
) {
}
