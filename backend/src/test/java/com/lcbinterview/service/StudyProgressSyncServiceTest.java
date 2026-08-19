package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.StudyProgressSnapshotMapper;
import com.lcbinterview.model.StudyProgressSnapshot;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 学习进度云同步服务测试，覆盖 upsert 语义和快照容量保护。
 */
class StudyProgressSyncServiceTest {

    private StudyProgressSnapshotMapper studyProgressSnapshotMapper;
    private StudyProgressSyncService studyProgressSyncService;

    @BeforeEach
    void setUp() {
        // LambdaQueryWrapper 依赖表元数据，纯单测环境下需要手动初始化
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""),
                StudyProgressSnapshot.class);
        studyProgressSnapshotMapper = mock(StudyProgressSnapshotMapper.class);
        studyProgressSyncService = new StudyProgressSyncService(studyProgressSnapshotMapper);
    }

    @Test
    void saveInsertsSnapshotWhenUserHasNone() {
        when(studyProgressSnapshotMapper.selectOne(any())).thenReturn(null);

        studyProgressSyncService.save(7L, "{\"progress\":1}", "2026-01-01T10:00:00");

        ArgumentCaptor<StudyProgressSnapshot> captor = ArgumentCaptor.forClass(StudyProgressSnapshot.class);
        verify(studyProgressSnapshotMapper).insert(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(7L);
        assertThat(captor.getValue().getProgressJson()).isEqualTo("{\"progress\":1}");
        assertThat(captor.getValue().getClientUpdatedAt()).isEqualTo("2026-01-01T10:00:00");
        verify(studyProgressSnapshotMapper, never()).updateById(any());
    }

    @Test
    void saveUpdatesExistingSnapshotInsteadOfInserting() {
        StudyProgressSnapshot existing = new StudyProgressSnapshot();
        existing.setId(1L);
        existing.setUserId(7L);
        existing.setProgressJson("{\"progress\":0}");
        when(studyProgressSnapshotMapper.selectOne(any())).thenReturn(existing);

        studyProgressSyncService.save(7L, "{\"progress\":2}", " 2026-02-02T08:30:00 ");

        // 已有快照走覆盖更新，保证一人仅一份最新快照
        assertThat(existing.getProgressJson()).isEqualTo("{\"progress\":2}");
        // 客户端时间做 trim，避免脏空白字符进入同步冲突判断
        assertThat(existing.getClientUpdatedAt()).isEqualTo("2026-02-02T08:30:00");
        verify(studyProgressSnapshotMapper).updateById(existing);
        verify(studyProgressSnapshotMapper, never()).insert(any(StudyProgressSnapshot.class));
    }

    @Test
    void saveRejectsBlankProgressJson() {
        // Arrays.asList 允许 null 元素，List.of 不允许
        List<String> invalidPayloads = java.util.Arrays.asList(null, "", "   ");

        for (String payload : invalidPayloads) {
            assertThatThrownBy(() -> studyProgressSyncService.save(7L, payload, null))
                    .isInstanceOfSatisfying(BusinessException.class,
                            exception -> assertThat(exception.getCode()).isEqualTo(400));
        }
        verify(studyProgressSnapshotMapper, never()).insert(any(StudyProgressSnapshot.class));
    }

    @Test
    void saveRejectsProgressJsonOverTwoMegabytes() {
        String oversized = "a".repeat(2 * 1024 * 1024 + 1);

        assertThatThrownBy(() -> studyProgressSyncService.save(7L, oversized, null))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getCode()).isEqualTo(400))
                .hasMessageContaining("2MB");
        verify(studyProgressSnapshotMapper, never()).insert(any(StudyProgressSnapshot.class));
    }

    @Test
    void loadReturnsLatestSnapshotOrNull() {
        StudyProgressSnapshot snapshot = new StudyProgressSnapshot();
        snapshot.setUserId(7L);
        snapshot.setProgressJson("{\"progress\":1}");
        when(studyProgressSnapshotMapper.selectOne(any())).thenReturn(snapshot);

        assertThat(studyProgressSyncService.load(7L)).isSameAs(snapshot);

        when(studyProgressSnapshotMapper.selectOne(any())).thenReturn(null);
        assertThat(studyProgressSyncService.load(8L)).isNull();
    }
}
