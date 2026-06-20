import type { StudyProgress } from '../types'
import { readPracticeAnswerDrafts, type PracticeAnswerDraft } from './practiceAnswerDraftStore'
import { buildDailyPracticePath } from './practiceRoute'

export interface PracticeDraftRecoveryItem {
  id: number
  title: string
  meta: string
  to: string
}

export interface PracticeDraftRecoveryModel {
  items: PracticeDraftRecoveryItem[]
  primaryPath: string
}

interface PracticeDraftRecoveryOptions {
  drafts?: PracticeAnswerDraft[]
  limit?: number
}

const DEFAULT_DRAFT_RECOVERY_LIMIT = 5

export function buildPracticeDraftRecovery(
  progress: StudyProgress,
  options: PracticeDraftRecoveryOptions = {},
): PracticeDraftRecoveryModel {
  const limit = Math.max(0, options.limit ?? DEFAULT_DRAFT_RECOVERY_LIMIT)
  const seen = new Set<number>()
  const drafts = options.drafts ?? readPracticeAnswerDrafts()
  const items = drafts
    .filter(draft => {
      if (!Number.isFinite(draft.questionId) || draft.questionId <= 0 || seen.has(draft.questionId)) {
        return false
      }
      seen.add(draft.questionId)
      return true
    })
    .map(draft => {
      const snapshot = progress.questionSnapshots[draft.questionId]
      const category = snapshot?.categoryName || '未分组'

      return {
        id: draft.questionId,
        title: snapshot?.title || `题目 ${draft.questionId}`,
        meta: `${category} · ${formatDraftUpdatedAt(draft.updatedAt)}`,
        to: buildDailyPracticePath([draft.questionId]),
      }
    })
    .slice(0, limit)

  return {
    items,
    primaryPath: buildDailyPracticePath(items.map(item => item.id)),
  }
}

function formatDraftUpdatedAt(updatedAt: string): string {
  const time = Date.parse(updatedAt)
  if (!Number.isFinite(time)) {
    return '本地草稿'
  }

  return `更新于 ${new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
