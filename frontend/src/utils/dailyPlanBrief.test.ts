import { describe, expect, it } from 'vitest'
import type { Question, StudyProgress, StudyQuestionStatus } from '../types'
import { createDefaultProgress, rememberQuestions } from './studyProgress'
import { buildDailyPlanBrief, buildDailyPlanBriefMarkdown } from './dailyPlanBrief'

const NOW = '2026-06-17T09:00:00.000Z'

function question(id: number, categoryName = 'Java 并发'): Question {
  return {
    id,
    title: `Question ${id}`,
    content: 'content',
    difficulty: 'MEDIUM',
    categoryName,
    categoryId: 1,
    tags: ['Java'],
    viewCount: 100 + id,
    createTime: '2026-06-15T00:00:00',
  }
}

function markQuestion(
  progress: StudyProgress,
  id: number,
  status: StudyQuestionStatus,
  lastReviewedAt = NOW,
  reviewCount = 1,
): StudyProgress {
  return {
    ...progress,
    questionStates: {
      ...progress.questionStates,
      [id]: {
        status,
        addedToPlan: progress.dailyPlan.includes(id),
        lastReviewedAt,
        reviewCount,
      },
    },
  }
}

describe('buildDailyPlanBrief', () => {
  it('returns an empty brief when today plan has no questions', () => {
    const brief = buildDailyPlanBrief(createDefaultProgress(NOW), [], NOW)

    expect(brief.title).toBe('今日计划待生成')
    expect(brief.totalCount).toBe(0)
    expect(brief.items).toEqual([])
    expect(brief.metrics.map(metric => metric.value)).toEqual(['0 道', '0 道', '0 道', '0 道'])
  })

  it('marks due review debts before status-based reasons while preserving plan order', () => {
    let progress = createDefaultProgress(NOW)
    progress = rememberQuestions(progress, [question(1), question(2), question(3)], NOW)
    progress = {
      ...progress,
      dailyPlan: [2, 1, 3],
    }
    progress = markQuestion(progress, 1, 'weak', '2026-06-10T09:00:00.000Z')
    progress = markQuestion(progress, 2, 'weak', NOW)
    progress = markQuestion(progress, 3, 'learning', NOW)

    const brief = buildDailyPlanBrief(progress, [], NOW)

    expect(brief.items.map(item => item.questionId)).toEqual([2, 1, 3])
    expect(brief.items.map(item => item.source)).toEqual(['weak', 'review-debt', 'learning'])
    expect(brief.items[1]).toMatchObject({
      dueStatus: 'overdue',
      actionLabel: '先复盘',
    })
    expect(brief.reviewDebtCount).toBe(1)
    expect(brief.weakCount).toBe(2)
  })

  it('classifies new and mastered questions and falls back when snapshots are missing', () => {
    let progress = createDefaultProgress(NOW)
    progress = {
      ...progress,
      dailyPlan: [5, 4, 6],
    }
    progress = markQuestion(progress, 6, 'mastered', NOW, 3)

    const brief = buildDailyPlanBrief(progress, [question(4, 'MySQL')], NOW)

    expect(brief.items.map(item => item.questionId)).toEqual([5, 4, 6])
    expect(brief.items.map(item => item.source)).toEqual(['new', 'new', 'mastered'])
    expect(brief.items[0]).toMatchObject({
      title: '题目 #5',
      categoryName: '未分组',
      actionLabel: '建立首轮记忆',
    })
    expect(brief.items[1]).toMatchObject({
      title: 'Question 4',
      categoryName: 'MySQL',
    })
    expect(brief.newCount).toBe(2)
  })

  it('exports planned daily brief as portable markdown', () => {
    let progress = createDefaultProgress(NOW)
    progress = rememberQuestions(progress, [question(1), question(2)], NOW)
    progress = {
      ...progress,
      dailyPlan: [2, 1],
      targetRole: 'Java 后端',
    }
    progress = markQuestion(progress, 1, 'weak', '2026-06-10T09:00:00.000Z')
    progress = markQuestion(progress, 2, 'new', NOW, 0)

    const markdown = buildDailyPlanBriefMarkdown(progress, [], NOW)

    expect(markdown).toContain('# Java 后端 今日作战简报')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 作战概览')
    expect(markdown).toContain('今日计划已拆解')
    expect(markdown).toContain('## 指标')
    expect(markdown).toContain('## 今日题单')
    expect(markdown).toContain('入口：/question/1')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty daily brief export actionable', () => {
    const markdown = buildDailyPlanBriefMarkdown(createDefaultProgress(NOW), [], NOW)

    expect(markdown).toContain('今日计划待生成')
    expect(markdown).toContain('今日计划还未生成')
    expect(markdown).not.toContain('undefined')
  })
})
