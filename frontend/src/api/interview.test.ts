import { describe, expect, it } from 'vitest'
import type { PracticeQueueItem } from '../types'
import { buildInterviewEvaluateRequest } from './interview'

const question: PracticeQueueItem = {
  id: 1,
  title: 'HashMap thread safety',
  difficulty: 'HARD',
  categoryName: 'Java Collections',
  categoryId: 1,
  tags: ['HashMap', 'Concurrency'],
  viewCount: 100,
  status: 'weak',
  source: 'review',
}

describe('interview api helpers', () => {
  it('builds backend evaluate request from a practice question', () => {
    const request = buildInterviewEvaluateRequest(question, ' answer ', 'Java Backend')

    expect(request).toEqual({
      questionTitle: 'HashMap thread safety',
      categoryName: 'Java Collections',
      tags: ['HashMap', 'Concurrency'],
      difficulty: 'HARD',
      targetRole: 'Java Backend',
      answer: 'answer',
    })
  })
})
