import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, StudyProgress, StudyQuestionStatus } from '../types'
import { buildStudyPaceCoach, buildStudyPaceMarkdown } from './studyPaceCoach'

const NOW = '2026-06-17T00:00:00.000Z'

function emptyProgress(): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: NOW,
  }
}

function addQuestion(
  progress: StudyProgress,
  id: number,
  status: StudyQuestionStatus = 'learning',
  lastReviewedAt = NOW,
) {
  progress.questionStates[id] = {
    status,
    addedToPlan: true,
    lastReviewedAt,
    reviewCount: status === 'new' ? 0 : 1,
  }
  progress.questionSnapshots[id] = {
    id,
    title: `题目 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    tags: ['并发'],
    viewCount: 100 + id,
  }
}

function interviewAttempt(questionId: number, score = 82): InterviewAttempt {
  return {
    questionId,
    answer: '模拟回答',
    createdAt: NOW,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : 'pass',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildStudyPaceCoach', () => {
  it('guides users to build the first learning trace when empty', () => {
    const coach = buildStudyPaceCoach(emptyProgress(), NOW)

    expect(coach.level).toBe('empty')
    expect(coach.primaryAction.to).toBe('/banks')
    expect(coach.dailyQuestionTarget).toBe(6)
  })

  it('prioritizes review debt over adding more new questions', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1, 'weak', '2026-06-10T00:00:00.000Z')
    addQuestion(progress, 2, 'learning', NOW)
    progress.dailyPlan = [1, 2, 3, 4, 5, 6]
    progress.interviewAttempts[1] = [interviewAttempt(1)]

    const coach = buildStudyPaceCoach(progress, NOW)

    expect(coach.level).toBe('behind')
    expect(coach.primaryAction.key).toBe('review')
    expect(coach.reviewDueCount).toBeGreaterThan(0)
  })

  it('asks users to fill the daily plan when planned count is below target', () => {
    const progress = emptyProgress()
    addQuestion(progress, 1)
    addQuestion(progress, 2)
    progress.dailyPlan = [1]
    progress.interviewAttempts[1] = [interviewAttempt(1)]

    const coach = buildStudyPaceCoach(progress, NOW)

    expect(coach.level).toBe('behind')
    expect(coach.primaryAction.key).toBe('plan')
    expect(coach.plannedCount).toBe(1)
  })

  it('asks for a mock interview when pacing is otherwise enough but no interview sample exists', () => {
    const progress = emptyProgress()
    for (let id = 1; id <= 6; id += 1) {
      addQuestion(progress, id)
    }
    progress.dailyPlan = [1, 2, 3, 4, 5, 6]

    const coach = buildStudyPaceCoach(progress, NOW)

    expect(coach.level).toBe('behind')
    expect(coach.primaryAction.key).toBe('interview')
  })

  it('marks pacing as balanced when plan and interview sample are both ready', () => {
    const progress = emptyProgress()
    for (let id = 1; id <= 6; id += 1) {
      addQuestion(progress, id, id <= 3 ? 'mastered' : 'learning')
    }
    progress.dailyPlan = [1, 2, 3, 4, 5, 6]
    progress.interviewAttempts[1] = [interviewAttempt(1)]

    const coach = buildStudyPaceCoach(progress, NOW)

    expect(coach.level).toBe('balanced')
    expect(coach.primaryAction.key).toBe('practice')
    expect(coach.primaryAction.to).toBe('/practice?queue=4,5,6')
  })

  it('routes completed daily plans to study closeout instead of another practice queue', () => {
    const progress = emptyProgress()
    for (let id = 1; id <= 6; id += 1) {
      addQuestion(progress, id, 'mastered')
    }
    progress.dailyPlan = [1, 2, 3, 4, 5, 6]
    progress.interviewAttempts[1] = [interviewAttempt(1)]

    const coach = buildStudyPaceCoach(progress, NOW)

    expect(coach.primaryAction).toMatchObject({
      key: 'plan',
      to: '/study',
    })
  })

  it('marks pacing as ahead when the daily plan exceeds the target and interview samples exist', () => {
    const progress = emptyProgress()
    progress.sprintDays = 45
    for (let id = 1; id <= 8; id += 1) {
      addQuestion(progress, id, 'mastered')
    }
    progress.dailyPlan = [1, 2, 3, 4, 5, 6]
    progress.interviewAttempts[1] = [interviewAttempt(1)]
    progress.interviewAttempts[2] = [interviewAttempt(2)]

    const coach = buildStudyPaceCoach(progress, NOW)

    expect(coach.level).toBe('ahead')
    expect(coach.dailyQuestionTarget).toBe(4)
  })

  it('exports behind pace coach as portable markdown', () => {
    const progress = emptyProgress()
    progress.targetRole = 'Java 后端'
    addQuestion(progress, 1)
    addQuestion(progress, 2)
    progress.dailyPlan = [1]
    progress.interviewAttempts[1] = [interviewAttempt(1)]

    const markdown = buildStudyPaceMarkdown(progress, NOW)

    expect(markdown).toContain('# Java 后端 备考配速报告')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 配速概览')
    expect(markdown).toContain('## 指标明细')
    expect(markdown).toContain('## 行动队列')
    expect(markdown).toContain('入口：/study')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty pace export actionable', () => {
    const markdown = buildStudyPaceMarkdown(emptyProgress(), NOW)

    expect(markdown).toContain('建立')
    expect(markdown).toContain('入口：/banks')
    expect(markdown).not.toContain('undefined')
  })
})
