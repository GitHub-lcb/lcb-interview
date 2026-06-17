import { describe, expect, it } from 'vitest'
import type { PrepRoute } from '../data/freeSuperiority'
import { createDefaultProgress, rememberQuestions, toggleQuestionInPlan, updateQuestionStatus } from './studyProgress'
import { buildRouteProgress, buildRouteProgressList } from './routeProgress'
import type { Question } from '../types'

const javaRoute: PrepRoute = {
  id: 'java',
  title: 'Java 路线',
  role: 'Java 后端',
  duration: '21 天',
  summary: 'Java 后端路线',
  stages: ['基础', '并发'],
  categories: ['Java 基础', 'Java 并发'],
  actions: [{ label: '搜索 Java', to: '/search?q=Java' }],
}

const aiRoute: PrepRoute = {
  id: 'ai',
  title: 'AI 路线',
  role: 'AI 应用工程师',
  duration: '14 天',
  summary: 'AI 应用路线',
  stages: ['RAG', 'Agent'],
  categories: ['AI 大模型', 'AI 项目实战'],
  actions: [{ label: '搜索 AI', to: '/search?q=AI' }],
}

function question(id: number, categoryName: string, tags: string[] = []): Question {
  return {
    id,
    title: `Question ${id}`,
    content: 'content',
    difficulty: 'MEDIUM',
    categoryName,
    tags,
    viewCount: 10,
    createTime: '2026-06-17T00:00:00',
  }
}

describe('routeProgress', () => {
  it('matches remembered questions by route category names', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [
      question(1, 'Java 基础'),
      question(2, 'MySQL'),
    ])

    const routeProgress = buildRouteProgress(javaRoute, progress)

    expect(routeProgress.questionIds).toEqual([1])
    expect(routeProgress.totalRemembered).toBe(1)
  })

  it('matches remembered questions by tags when category name differs', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [
      question(3, '后端场景题', ['Java 并发']),
    ])

    const routeProgress = buildRouteProgress(javaRoute, progress)

    expect(routeProgress.questionIds).toEqual([3])
  })

  it('calculates tracked, planned, weak, mastered and completion rate', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [
      question(1, 'Java 基础'),
      question(2, 'Java 并发'),
      question(3, 'Java 并发'),
    ])
    progress = updateQuestionStatus(progress, 1, 'mastered')
    progress = updateQuestionStatus(progress, 2, 'weak')
    progress = toggleQuestionInPlan(progress, 2, true)

    const routeProgress = buildRouteProgress(javaRoute, progress)

    expect(routeProgress.totalRemembered).toBe(3)
    expect(routeProgress.tracked).toBe(2)
    expect(routeProgress.planned).toBe(1)
    expect(routeProgress.weak).toBe(1)
    expect(routeProgress.mastered).toBe(1)
    expect(routeProgress.completionRate).toBe(33)
  })

  it('sorts routes with weak and underplanned work first', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [
      question(1, 'Java 基础'),
      question(2, 'AI 大模型'),
    ])
    progress = updateQuestionStatus(progress, 1, 'weak')
    progress = updateQuestionStatus(progress, 2, 'mastered')
    progress = toggleQuestionInPlan(progress, 2, true)

    const routes = buildRouteProgressList([aiRoute, javaRoute], progress)

    expect(routes[0].route.id).toBe('java')
  })

  it('returns safe empty progress for routes without remembered questions', () => {
    const routeProgress = buildRouteProgress(javaRoute, createDefaultProgress())

    expect(routeProgress.questionIds).toEqual([])
    expect(routeProgress.totalRemembered).toBe(0)
    expect(routeProgress.completionRate).toBe(0)
    expect(routeProgress.nextQuestionIds).toEqual([])
  })
})
