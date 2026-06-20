import { describe, expect, it } from 'vitest'
import { getStreamResultMeta } from './aiGenerateResult'

describe('getStreamResultMeta', () => {
  it('formats successful quality score for generated questions', () => {
    const meta = getStreamResultMeta({
      status: 'completed',
      questionId: 12,
      title: '线程池参数如何配置？',
      qualityScore: 96,
    })

    expect(meta.title).toBe('线程池参数如何配置？')
    expect(meta.qualityText).toBe('质量 96')
    expect(meta.qualityColor).toBe('green')
    expect(meta.detail).toBe('')
  })

  it('formats failure reason and quality issues for rejected generated questions', () => {
    const meta = getStreamResultMeta({
      status: 'failed',
      current: 2,
      error: '质量分 62，问题：content 内容少于 500 字',
      qualityScore: 62,
      qualityIssues: ['content 内容少于 500 字', 'project_exp 项目经验缺失或过短'],
    })

    expect(meta.title).toBe('第 2 题')
    expect(meta.qualityText).toBe('质量 62')
    expect(meta.qualityColor).toBe('orange')
    expect(meta.detail).toContain('质量分 62')
    expect(meta.detail).toContain('project_exp 项目经验缺失或过短')
  })
})
