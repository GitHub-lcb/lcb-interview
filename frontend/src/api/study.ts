import api from './index'
import type { StudyProgress } from '../types'

/** 云端学习进度快照（后端存储整体 JSON，客户端 updatedAt 用于冲突提示）。 */
export interface StudyProgressSnapshotVO {
  progressJson: string | null
  updatedAt: string | null
}

/** 拉取云端学习进度快照。未登录时由调用方跳过；无快照时 progressJson 为 null。 */
export async function fetchStudyProgressSnapshot(): Promise<StudyProgressSnapshotVO> {
  const res = await api.get<{ data: StudyProgressSnapshotVO }>('/study/progress', {
    silentGlobalError: true,
  })
  return res.data.data
}

/**
 * 上传本地学习进度到云端。
 *
 * @param progress 本地完整进度对象，整体序列化后存储
 * @returns 上传是否成功（未登录或网络失败返回 false，调用方静默重试）
 */
export async function pushStudyProgressSnapshot(progress: StudyProgress): Promise<boolean> {
  try {
    await api.put('/study/progress', {
      progressJson: JSON.stringify(progress),
      clientUpdatedAt: progress.updatedAt,
    }, {
      silentGlobalError: true,
      // 进度可能包含大量题目快照，超时比默认 10s 稍宽
      timeout: 20000,
    })
    return true
  } catch {
    return false
  }
}

/**
 * 从云端快照恢复进度，解析失败时返回 null（云端数据异常不应覆盖本地可用进度）。
 */
export async function pullStudyProgressSnapshot(): Promise<StudyProgress | null> {
  const snapshot = await fetchStudyProgressSnapshot()
  if (!snapshot.progressJson) {
    return null
  }
  try {
    return JSON.parse(snapshot.progressJson) as StudyProgress
  } catch {
    return null
  }
}
