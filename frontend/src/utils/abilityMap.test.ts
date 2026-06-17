import { describe, expect, it } from 'vitest'
import type { PrepRoute } from '../data/freeSuperiority'
import type { StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildAbilityMap } from './abilityMap'

const routes: PrepRoute[] = [
  {
    id: 'java-backend',
    title: 'Java 后端冲刺路线',
    role: 'Java 后端',
    duration: '21 天',
    summary: 'Java 后端能力',
    stages: [],
    categories: ['Java 并发', 'JVM'],
    actions: [],
  },
  {
    id: 'ai',
    title: 'AI 应用开发路线',
    role: 'AI 应用工程师',
    duration: '14 天',
    summary: 'AI 能力',
    stages: [],
    categories: ['AI 大模型'],
    actions: [],
  },
]

function progressWithSnapshots(): StudyProgress {
  return {
    ...createDefaultProgress(),
    questionSnapshots: {
      1: { id: 1, title: '线程池参数', difficulty: 'MEDIUM', categoryName: 'Java 并发', tags: [], viewCount: 10 },
      2: { id: 2, title: 'JVM GC', difficulty: 'HARD', categoryName: '虚拟机', tags: ['JVM'], viewCount: 20 },
      3: { id: 3, title: 'RAG 检索', difficulty: 'MEDIUM', categoryName: 'AI 大模型', tags: ['RAG'], viewCount: 30 },
      4: { id: 4, title: '无关题', difficulty: 'EASY', categoryName: 'HR', tags: [], viewCount: 5 },
    },
    questionStates: {
      1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
      2: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      3: { status: 'learning', addedToPlan: true, reviewCount: 1 },
    },
  }
}

describe('abilityMap', () => {
  it('returns empty ability items when there are no remembered snapshots', () => {
    const items = buildAbilityMap(routes, createDefaultProgress())

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      routeId: 'java-backend',
      readinessScore: 0,
      readinessLevel: 'empty',
      remembered: 0,
    })
  })

  it('matches route categories against question category names and tags', () => {
    const java = buildAbilityMap(routes, progressWithSnapshots()).find(item => item.routeId === 'java-backend')

    expect(java?.remembered).toBe(2)
    expect(java?.mastered).toBe(1)
    expect(java?.weak).toBe(1)
  })

  it('calculates readiness with mastered, learning, weak, and new weights', () => {
    const ai = buildAbilityMap(routes, progressWithSnapshots()).find(item => item.routeId === 'ai')

    expect(ai?.readinessScore).toBe(60)
    expect(ai?.readinessLevel).toBe('building')
  })

  it('excludes mastered questions from next practice ids', () => {
    const java = buildAbilityMap(routes, progressWithSnapshots()).find(item => item.routeId === 'java-backend')

    expect(java?.nextQuestionIds).toEqual([2])
  })

  it('sorts weaker ability areas before stronger areas', () => {
    const items = buildAbilityMap(routes, progressWithSnapshots())

    expect(items.map(item => item.routeId)).toEqual(['java-backend', 'ai'])
  })
})
