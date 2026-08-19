import { describe, expect, it } from 'vitest'
import { previewIntervalDays, scheduleNextRecall, SM2_EASE_DEFAULT } from './spacedRepetition'

describe('scheduleNextRecall', () => {
  it('首次背诵评 good，间隔为 1 天且难度系数不变', () => {
    const result = scheduleNextRecall({ reviewCount: 0 }, 'good', new Date('2026-08-19T10:00:00Z'))
    expect(result.intervalDays).toBe(1)
    expect(result.easeFactor).toBe(SM2_EASE_DEFAULT)
    expect(result.status).toBe('learning')
    expect(result.dueAt).toBe('2026-08-20T10:00:00.000Z')
  })

  it('第二次评 good，间隔进入 6 天标准序列', () => {
    const first = scheduleNextRecall({ reviewCount: 0 }, 'good')
    const second = scheduleNextRecall(
      { reviewCount: 1, easeFactor: first.easeFactor, intervalDays: first.intervalDays },
      'good',
    )
    expect(second.intervalDays).toBe(6)
  })

  it('后续评 good，间隔按难度系数指数拉长', () => {
    const second = scheduleNextRecall({ reviewCount: 1, intervalDays: 6, easeFactor: 2.5 }, 'good')
    expect(second.intervalDays).toBe(15) // 6 * 2.5
  })

  it('评 again，间隔重置为 1 天并标记薄弱', () => {
    const result = scheduleNextRecall({ reviewCount: 5, intervalDays: 21, easeFactor: 2.0 }, 'again')
    expect(result.intervalDays).toBe(1)
    expect(result.status).toBe('weak')
    expect(result.easeFactor).toBe(1.8) // 2.0 - 0.2
  })

  it('评 hard，间隔温和放大且不早于 1 天', () => {
    const fromZero = scheduleNextRecall({ reviewCount: 0 }, 'hard')
    expect(fromZero.intervalDays).toBe(1)
    const fromTen = scheduleNextRecall({ reviewCount: 3, intervalDays: 10, easeFactor: 2.5 }, 'hard')
    expect(fromTen.intervalDays).toBe(12) // 10 * 1.2
    expect(fromTen.easeFactor).toBe(2.35) // 2.5 - 0.15
  })

  it('评 easy 且间隔足够长，标记已掌握', () => {
    const result = scheduleNextRecall({ reviewCount: 2, intervalDays: 6, easeFactor: 2.5 }, 'easy')
    expect(result.status).toBe('mastered')
    expect(result.easeFactor).toBe(2.65)
    // 6 与 6 取较大者 6，乘难度系数 2.65 再乘奖励系数 1.3
    expect(result.intervalDays).toBe(Math.round(6 * 2.65 * 1.3))
  })

  it('首次评 easy 间隔足够长（21 天），直接标记已掌握', () => {
    const result = scheduleNextRecall({ reviewCount: 0 }, 'easy')
    expect(result.status).toBe('mastered')
    expect(result.intervalDays).toBe(21) // round(6 * 2.65 * 1.3)
  })

  it('难度系数被夹在 [1.3, 2.8]', () => {
    const lowered = scheduleNextRecall({ reviewCount: 9, intervalDays: 30, easeFactor: 1.35 }, 'again')
    expect(lowered.easeFactor).toBe(1.3)
    const raised = scheduleNextRecall({ reviewCount: 9, intervalDays: 30, easeFactor: 2.7 }, 'easy')
    expect(raised.easeFactor).toBe(2.8)
  })

  it('间隔存在 90 天上限，防止极端难度系数下无限拉长', () => {
    const result = scheduleNextRecall({ reviewCount: 9, intervalDays: 90, easeFactor: 2.8 }, 'easy')
    expect(result.intervalDays).toBe(90)
  })
})

describe('previewIntervalDays', () => {
  it('与 scheduleNextRecall 的间隔一致，方便按钮提示复用同一套计算', () => {
    const state = { reviewCount: 2, intervalDays: 6, easeFactor: 2.5 }
    expect(previewIntervalDays(state, 'good')).toBe(scheduleNextRecall(state, 'good').intervalDays)
    expect(previewIntervalDays(state, 'again')).toBe(1)
  })
})
