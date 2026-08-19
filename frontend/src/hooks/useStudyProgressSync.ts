import { useCallback, useEffect, useRef, useState } from 'react'
import type { StudyProgress } from '../types'
import { readUserToken } from '../utils/authToken'
import { STUDY_PROGRESS_EVENT, readStudyProgress, writeStudyProgress } from '../utils/studyProgress'
import { pullStudyProgressSnapshot, pushStudyProgressSnapshot } from '../api/study'

/** 触发一次云同步的最小间隔：避免高频进度写入（列表页批量 remember）打爆接口。 */
const PUSH_DEBOUNCE_MS = 5000

export interface StudyProgressSyncState {
  syncing: boolean
  lastSyncedAt: string | null
  /** 同步失败时给用户提示，null 表示无异常或未登录。 */
  error: string | null
}

/**
 * 学习进度云同步 Hook：登录状态下自动把本地进度推送到服务端，并支持从云端拉取恢复。
 *
 * 同步策略（为什么这样做）：
 * - 推送按 updatedAt 做最后写入胜出（last-write-wins），本地每次写入 5 秒去抖后上传，
 *   多设备场景下以最后操作的设备为准，简单可靠，不需要服务端做字段级合并。
 * - 拉取只发生在用户显式点击「从云端恢复」时：自动拉取可能在用户刚做完本地操作时
 *   用旧云端数据覆盖本地，显式恢复 + updatedAt 对比提示更安全。
 */
export function useStudyProgressSync(progress: StudyProgress) {
  const [syncState, setSyncState] = useState<StudyProgressSyncState>({
    syncing: false,
    lastSyncedAt: null,
    error: null,
  })
  const pushTimer = useRef<number | null>(null)
  // 记录最近一次成功上传的 updatedAt，避免同一份数据反复上传。
  const lastPushedAt = useRef<string | null>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress

  const push = useCallback(async () => {
    if (!readUserToken()) {
      return
    }
    const current = progressRef.current
    if (lastPushedAt.current === current.updatedAt) {
      return
    }
    setSyncState(prev => ({ ...prev, syncing: true, error: null }))
    const ok = await pushStudyProgressSnapshot(current)
    if (ok) {
      lastPushedAt.current = current.updatedAt
      setSyncState({ syncing: false, lastSyncedAt: new Date().toISOString(), error: null })
    } else {
      setSyncState(prev => ({ ...prev, syncing: false, error: '云同步失败，稍后自动重试' }))
    }
  }, [])

  // 监听进度变化事件，去抖后推送云端。挂载时也会触发一次首同步。
  useEffect(() => {
    const schedulePush = () => {
      if (pushTimer.current !== null) {
        window.clearTimeout(pushTimer.current)
      }
      pushTimer.current = window.setTimeout(() => {
        pushTimer.current = null
        void push()
      }, PUSH_DEBOUNCE_MS)
    }
    schedulePush()
    window.addEventListener(STUDY_PROGRESS_EVENT, schedulePush)
    window.addEventListener('storage', schedulePush)
    return () => {
      if (pushTimer.current !== null) {
        window.clearTimeout(pushTimer.current)
      }
      window.removeEventListener(STUDY_PROGRESS_EVENT, schedulePush)
      window.removeEventListener('storage', schedulePush)
    }
  }, [push])

  /**
   * 从云端恢复进度：云端比本地新才覆盖，本地更新则提示无需恢复。
   * 返回描述结果的文案，由调用方决定展示方式。
   */
  const pull = useCallback(async (): Promise<string> => {
    if (!readUserToken()) {
      return '未登录，请先登录后再使用云同步'
    }
    setSyncState(prev => ({ ...prev, syncing: true, error: null }))
    const remote = await pullStudyProgressSnapshot()
    setSyncState(prev => ({ ...prev, syncing: false }))
    if (!remote) {
      return '云端没有可恢复的学习进度'
    }
    const local = readStudyProgress()
    const remoteNewer = remote.updatedAt > local.updatedAt
    if (!remoteNewer && remote.updatedAt !== local.updatedAt) {
      return `本地进度（${local.updatedAt.slice(0, 19)}）比云端（${remote.updatedAt.slice(0, 19)}）更新，已保持本地版本`
    }
    writeStudyProgress(remote)
    lastPushedAt.current = remote.updatedAt
    setSyncState({ syncing: false, lastSyncedAt: new Date().toISOString(), error: null })
    return `已从云端恢复学习进度（${remote.updatedAt.slice(0, 19)}）`
  }, [])

  return { ...syncState, push, pull }
}
