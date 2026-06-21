import { describe, expect, it } from 'vitest'
import type { StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildPracticeDraftRecovery } from './practiceDraftRecovery'
import type { PracticeAnswerDraft } from './practiceAnswerDraftStore'

function progress(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-20T09:00:00.000Z'),
    questionSnapshots: {
      2: {
        id: 2,
        title: 'Redis 缓存雪崩',
        difficulty: 'MEDIUM',
        categoryName: 'Redis',
        tags: ['Redis'],
        viewCount: 240,
      },
      5: {
        id: 5,
        title: 'Spring 事务传播',
        difficulty: 'HARD',
        categoryName: 'Spring',
        tags: ['Spring'],
        viewCount: 200,
      },
    },
  }
}

describe('buildPracticeDraftRecovery', () => {
  it('keeps draft recovery routes scoped as resume-draft sessions', () => {
    const drafts: PracticeAnswerDraft[] = [
      { questionId: 2, draft: 'Redis 草稿', updatedAt: '2026-06-20T09:30:00.000Z' },
      { questionId: 5, draft: 'Spring 草稿', updatedAt: '2026-06-20T09:20:00.000Z' },
    ]

    const recovery = buildPracticeDraftRecovery(progress(), { drafts })

    expect(recovery.primaryPath).toBe('/practice?queue=2,5&from=resume-draft')
    expect(recovery.items.map(item => item.to)).toEqual([
      '/practice?queue=2&from=resume-draft',
      '/practice?queue=5&from=resume-draft',
    ])
  })

  it('drops invalid and duplicate draft ids before building recovery links', () => {
    const drafts: PracticeAnswerDraft[] = [
      { questionId: 2.5, draft: 'invalid decimal draft', updatedAt: '2026-06-20T09:50:00.000Z' },
      { questionId: Number.NaN, draft: 'invalid NaN draft', updatedAt: '2026-06-20T09:45:00.000Z' },
      { questionId: Number.POSITIVE_INFINITY, draft: 'invalid infinity draft', updatedAt: '2026-06-20T09:40:00.000Z' },
      { questionId: -1, draft: 'invalid negative draft', updatedAt: '2026-06-20T09:35:00.000Z' },
      { questionId: 2, draft: 'Redis 草稿', updatedAt: '2026-06-20T09:30:00.000Z' },
      { questionId: 2, draft: 'Redis 旧草稿', updatedAt: '2026-06-20T09:20:00.000Z' },
      { questionId: 5, draft: 'Spring 草稿', updatedAt: '2026-06-20T09:10:00.000Z' },
    ]

    const recovery = buildPracticeDraftRecovery(progress(), { drafts })

    expect(recovery.primaryPath).toBe('/practice?queue=2,5&from=resume-draft')
    expect(recovery.items.map(item => item.id)).toEqual([2, 5])
    expect(recovery.items.map(item => item.to)).toEqual([
      '/practice?queue=2&from=resume-draft',
      '/practice?queue=5&from=resume-draft',
    ])
  })
})
