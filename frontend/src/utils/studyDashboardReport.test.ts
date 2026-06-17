import { describe, expect, it } from 'vitest'
import type { Question, StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildStudyDashboardMarkdown } from './studyDashboardReport'

const questions: Question[] = [
  {
    id: 1,
    title: 'HashMap 为什么线程不安全？',
    content: '标准答案',
    difficulty: 'HARD',
    categoryName: 'Java 集合',
    categoryId: 1,
    tags: ['HashMap', '并发'],
    viewCount: 300,
    createTime: '2026-06-18T00:00:00.000Z',
  },
  {
    id: 2,
    title: 'Redis 缓存雪崩怎么处理？',
    content: '标准答案',
    difficulty: 'MEDIUM',
    categoryName: 'Redis',
    categoryId: 2,
    tags: ['Redis'],
    viewCount: 240,
    createTime: '2026-06-18T00:00:00.000Z',
  },
  {
    id: 3,
    title: 'MySQL 索引为什么会失效？',
    content: '标准答案',
    difficulty: 'MEDIUM',
    categoryName: 'MySQL',
    categoryId: 3,
    tags: ['MySQL'],
    viewCount: 180,
    createTime: '2026-06-18T00:00:00.000Z',
  },
]

function progress(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {
      1: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      3: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
    },
    dailyPlan: [1, 2],
  }
}

describe('buildStudyDashboardMarkdown', () => {
  it('exports dashboard daily report with plan and weak areas', () => {
    const markdown = buildStudyDashboardMarkdown(progress(), questions, '2026-06-18T00:00:00.000Z')

    expect(markdown).toContain('# Java 后端 备考工作台日报')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 工作台概览')
    expect(markdown).toContain('## 下一题')
    expect(markdown).toContain('## 今日计划题单')
    expect(markdown).toContain('## 弱点雷达')
    expect(markdown).toContain('路径：/question/1')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty dashboard report actionable', () => {
    const markdown = buildStudyDashboardMarkdown(
      createDefaultProgress('2026-06-18T00:00:00.000Z'),
      [],
      '2026-06-18T00:00:00.000Z',
    )

    expect(markdown).toContain('先生成今日计划')
    expect(markdown).toContain('暂无弱点雷达')
    expect(markdown).not.toContain('undefined')
  })
})
