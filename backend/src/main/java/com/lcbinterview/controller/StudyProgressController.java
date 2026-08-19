package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.config.AuthUserContext;
import com.lcbinterview.dto.StudyProgressSyncRequest;
import com.lcbinterview.dto.StudyProgressVO;
import com.lcbinterview.service.StudyProgressSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 学习进度云同步接口。普通用户登录后可把本地学习进度 JSON 快照
 * 上传到服务端或在换机/清缓存后回读，路径受普通用户认证拦截保护。
 */
@Slf4j
@Tag(name = "学习进度云同步")
@RestController
@RequestMapping("/api/study/progress")
@RequiredArgsConstructor
public class StudyProgressController {

    private final StudyProgressSyncService studyProgressSyncService;

    /**
     * 查询当前用户最新的学习进度快照。
     *
     * @return 快照内容；用户从未同步过时 progressJson 为 null
     */
    @Operation(summary = "查询当前用户学习进度快照")
    @GetMapping
    public ResponseEntity<ApiResponse<StudyProgressVO>> get() {
        Long userId = AuthUserContext.currentUserId();
        StudyProgressVO vo = StudyProgressVO.from(studyProgressSyncService.load(userId));
        log.info("用户 {} 查询学习进度快照，存在: {}", userId, vo.progressJson() != null);
        return ResponseEntity.ok(ApiResponse.success(vo));
    }

    /**
     * 上传（同步）当前用户的学习进度快照，覆盖旧快照。
     *
     * @param request 同步请求，包含进度 JSON 和客户端更新时间
     * @return 空响应
     */
    @Operation(summary = "上传学习进度快照")
    @PutMapping
    public ResponseEntity<ApiResponse<Void>> sync(@Valid @RequestBody StudyProgressSyncRequest request) {
        Long userId = AuthUserContext.currentUserId();
        studyProgressSyncService.save(userId, request.progressJson(), request.clientUpdatedAt());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
