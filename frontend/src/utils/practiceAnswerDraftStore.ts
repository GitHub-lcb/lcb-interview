export const PRACTICE_ANSWER_DRAFT_STORAGE_KEY = 'lcb-interview-practice-answer-drafts'
export const PRACTICE_ANSWER_DRAFT_EVENT = 'lcb-practice-answer-draft-change'

export interface PracticeAnswerDraft {
  questionId: number
  draft: string
  updatedAt: string
}

const MAX_DRAFTS = 30
const MAX_DRAFT_LENGTH = 1600

export function readPracticeAnswerDrafts(storage: Storage = window.localStorage): PracticeAnswerDraft[] {
  try {
    const raw = storage.getItem(PRACTICE_ANSWER_DRAFT_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(isPracticeAnswerDraft)
      .sort(compareDraftUpdatedAtDesc)
      .slice(0, MAX_DRAFTS)
  } catch {
    return []
  }
}

export function readPracticeAnswerDraft(
  questionId: number,
  storage: Storage = window.localStorage,
): string | null {
  return readPracticeAnswerDrafts(storage).find(draft => draft.questionId === questionId)?.draft ?? null
}

export function writePracticeAnswerDraft(
  questionId: number,
  draft: string,
  updatedAt = new Date().toISOString(),
  storage: Storage = window.localStorage,
): PracticeAnswerDraft[] {
  if (!isValidQuestionId(questionId) || !draft.trim()) {
    return clearPracticeAnswerDraft(questionId, storage)
  }

  const normalizedDraft = draft.slice(0, MAX_DRAFT_LENGTH)
  const nextDrafts = [
    { questionId, draft: normalizedDraft, updatedAt },
    ...readPracticeAnswerDrafts(storage).filter(item => item.questionId !== questionId),
  ]
    .sort(compareDraftUpdatedAtDesc)
    .slice(0, MAX_DRAFTS)

  persistPracticeAnswerDrafts(nextDrafts, storage)
  return nextDrafts
}

export function clearPracticeAnswerDraft(
  questionId: number,
  storage: Storage = window.localStorage,
): PracticeAnswerDraft[] {
  if (!isValidQuestionId(questionId)) {
    return readPracticeAnswerDrafts(storage)
  }

  const nextDrafts = readPracticeAnswerDrafts(storage).filter(draft => draft.questionId !== questionId)
  persistPracticeAnswerDrafts(nextDrafts, storage)
  return nextDrafts
}

function persistPracticeAnswerDrafts(drafts: PracticeAnswerDraft[], storage: Storage): void {
  try {
    if (drafts.length === 0) {
      storage.removeItem(PRACTICE_ANSWER_DRAFT_STORAGE_KEY)
      dispatchPracticeAnswerDraftEvent(storage)
      return
    }

    storage.setItem(PRACTICE_ANSWER_DRAFT_STORAGE_KEY, JSON.stringify(drafts))
    dispatchPracticeAnswerDraftEvent(storage)
  } catch {
    // 浏览器隐私模式或容量不足时，练习页仍应保持可用，只是不保留本地草稿。
  }
}

function dispatchPracticeAnswerDraftEvent(storage: Storage): void {
  if (storage !== window.localStorage) {
    return
  }

  window.dispatchEvent(new Event(PRACTICE_ANSWER_DRAFT_EVENT))
}

function isPracticeAnswerDraft(value: unknown): value is PracticeAnswerDraft {
  if (!value || typeof value !== 'object') {
    return false
  }

  const draft = value as PracticeAnswerDraft
  return isValidQuestionId(draft.questionId)
    && typeof draft.draft === 'string'
    && draft.draft.trim().length > 0
    && typeof draft.updatedAt === 'string'
    && draft.updatedAt.trim().length > 0
}

function isValidQuestionId(questionId: number): boolean {
  return Number.isInteger(questionId) && questionId > 0
}

function compareDraftUpdatedAtDesc(left: PracticeAnswerDraft, right: PracticeAnswerDraft): number {
  const timeDiff = Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  if (Number.isFinite(timeDiff) && timeDiff !== 0) {
    return timeDiff
  }
  return right.updatedAt.localeCompare(left.updatedAt) || right.questionId - left.questionId
}
