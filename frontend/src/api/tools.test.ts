import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LotteryKl8Recommendation } from '../types'

vi.mock('./index', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import api from './index'
import { createKl8Recommendation } from './tools'

const recommendation: LotteryKl8Recommendation = {
  id: 1,
  source: 'AI',
  baseIssueCount: 120,
  latestIssueNo: '20260629001',
  groups: [
    {
      numbers: [1, 8, 18, 28, 38],
      reason: 'test',
    },
  ],
  featureSummary: 'test',
  disclaimer: 'test',
  createdAt: '2026-06-29T10:00:00',
}

describe('tools api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses an extended timeout for AI lottery recommendations', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: recommendation } })

    await createKl8Recommendation(120)

    expect(api.post).toHaveBeenCalledWith(
      '/tools/lottery/kl8/recommendations',
      { baseIssueCount: 120 },
      { timeout: 120000 },
    )
  })
})
