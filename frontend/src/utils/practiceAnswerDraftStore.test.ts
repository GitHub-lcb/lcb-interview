import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PRACTICE_ANSWER_DRAFT_EVENT,
  PRACTICE_ANSWER_DRAFT_STORAGE_KEY,
  clearPracticeAnswerDraft,
  readPracticeAnswerDraft,
  readPracticeAnswerDrafts,
  writePracticeAnswerDraft,
} from './practiceAnswerDraftStore'

const NOW = '2026-06-20T09:30:00.000Z'

describe('practiceAnswerDraftStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('writes and restores a draft by question id', () => {
    writePracticeAnswerDraft(12, '结论：HashMap 并发写会产生数据覆盖。', NOW)

    expect(readPracticeAnswerDraft(12)).toBe('结论：HashMap 并发写会产生数据覆盖。')
    expect(readPracticeAnswerDrafts()).toEqual([
      {
        questionId: 12,
        draft: '结论：HashMap 并发写会产生数据覆盖。',
        updatedAt: NOW,
      },
    ])
  })

  it('clears only the requested blank draft', () => {
    writePracticeAnswerDraft(1, '题目 1 草稿', '2026-06-20T09:00:00.000Z')
    writePracticeAnswerDraft(2, '题目 2 草稿', '2026-06-20T09:01:00.000Z')

    writePracticeAnswerDraft(1, '   ', NOW)

    expect(readPracticeAnswerDraft(1)).toBeNull()
    expect(readPracticeAnswerDraft(2)).toBe('题目 2 草稿')
  })

  it('keeps the latest 30 drafts to avoid unbounded localStorage growth', () => {
    for (let questionId = 1; questionId <= 31; questionId += 1) {
      writePracticeAnswerDraft(
        questionId,
        `题目 ${questionId} 草稿`,
        `2026-06-20T09:${String(questionId).padStart(2, '0')}:00.000Z`,
      )
    }

    const drafts = readPracticeAnswerDrafts()

    expect(drafts).toHaveLength(30)
    expect(drafts[0].questionId).toBe(31)
    expect(drafts.some(draft => draft.questionId === 1)).toBe(false)
  })

  it('resets corrupted payloads instead of crashing the practice page', () => {
    window.localStorage.setItem(PRACTICE_ANSWER_DRAFT_STORAGE_KEY, '{bad json')

    expect(readPracticeAnswerDraft(1)).toBeNull()
    expect(readPracticeAnswerDrafts()).toEqual([])
  })

  it('drops fractional question ids from persisted drafts', () => {
    window.localStorage.setItem(PRACTICE_ANSWER_DRAFT_STORAGE_KEY, JSON.stringify([
      { questionId: 2.5, draft: 'invalid decimal draft', updatedAt: '2026-06-20T09:40:00.000Z' },
      { questionId: 2, draft: 'question 2 draft', updatedAt: '2026-06-20T09:30:00.000Z' },
    ]))

    expect(readPracticeAnswerDrafts()).toEqual([
      {
        questionId: 2,
        draft: 'question 2 draft',
        updatedAt: '2026-06-20T09:30:00.000Z',
      },
    ])
  })

  it('removes a draft explicitly while keeping other questions intact', () => {
    writePracticeAnswerDraft(1, '题目 1 草稿', '2026-06-20T09:00:00.000Z')
    writePracticeAnswerDraft(2, '题目 2 草稿', '2026-06-20T09:01:00.000Z')

    clearPracticeAnswerDraft(2)

    expect(readPracticeAnswerDraft(1)).toBe('题目 1 草稿')
    expect(readPracticeAnswerDraft(2)).toBeNull()
  })

  it('notifies same-tab listeners when drafts change', () => {
    const listener = vi.fn()
    window.addEventListener(PRACTICE_ANSWER_DRAFT_EVENT, listener)

    writePracticeAnswerDraft(1, '题目 1 草稿', NOW)
    clearPracticeAnswerDraft(1)
    window.removeEventListener(PRACTICE_ANSWER_DRAFT_EVENT, listener)

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
