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
import { createKl8Recommendation, getKl8Coverage, syncKl8Draws } from './tools'

const recommendation: LotteryKl8Recommendation = {
  id: 1,
  source: 'RULE_BASED',
  pickSize: 4,
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

  it('uses an extended timeout for Java lottery recommendations', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: recommendation } })

    await createKl8Recommendation(120)

    expect(api.post).toHaveBeenCalledWith(
      '/tools/lottery/kl8/recommendations',
      { baseIssueCount: 120 },
      { timeout: 120000 },
    )
  })

  it('uses an extended timeout for lottery draw sync', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { success: true } } })

    await syncKl8Draws()

    expect(api.post).toHaveBeenCalledWith(
      '/tools/lottery/kl8/sync',
      undefined,
      { timeout: 120000 },
    )
  })

  it('requests the coverage optimizer report with the given parameters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { curve: [] } } })

    await getKl8Coverage({ pickSize: 4, minHitLevel: 2, maxTickets: 20, budgetYuan: 20 })

    expect(api.get).toHaveBeenCalledWith('/tools/lottery/kl8/coverage', {
      params: { pickSize: 4, minHitLevel: 2, maxTickets: 20, budgetYuan: 20 },
    })
  })

  it('sends no params when the coverage optimizer uses defaults', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { curve: [] } } })

    await getKl8Coverage()

    expect(api.get).toHaveBeenCalledWith('/tools/lottery/kl8/coverage', { params: {} })
  })
})
