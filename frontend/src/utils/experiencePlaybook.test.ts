import { describe, expect, it } from 'vitest'
import type { ExperienceSet } from '../data/freeSuperiority'
import type { StudyProgress } from '../types'
import { buildExperiencePlaybookMarkdown, buildExperiencePressureQueue } from './experiencePlaybook'
import { createDefaultProgress } from './studyProgress'

const sets: ExperienceSet[] = [
  {
    id: 'big-tech-java',
    title: '大厂 Java 后端面试组',
    companyType: '一二线互联网',
    summary: '按真实面试节奏组合基础、项目、分布式、数据库和缓存追问。',
    drills: ['自我介绍后的项目深挖', 'JVM 与并发追问'],
    actions: [
      { label: '刷后端场景题', to: '/search?q=后端场景' },
      { label: '开始一轮练习', to: '/practice' },
    ],
  },
]

describe('experiencePlaybook', () => {
  it('exports interview experience sets as portable markdown', () => {
    const markdown = buildExperiencePlaybookMarkdown(sets, 'Java 后端', '2026-06-18T09:00:00.000Z')

    expect(markdown).toContain('# Java 后端 真实面试场景包')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 场景总览')
    expect(markdown).toContain('场景组：1 组')
    expect(markdown).toContain('## 场景题单')
    expect(markdown).toContain('1. 大厂 Java 后端面试组')
    expect(markdown).toContain('公司类型：一二线互联网')
    expect(markdown).toContain('追问主题：自我介绍后的项目深挖、JVM 与并发追问')
    expect(markdown).toContain('刷后端场景题（/search?q=后端场景）')
    expect(markdown).toContain('开始一轮练习（/practice）')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty experience playbook export actionable', () => {
    const markdown = buildExperiencePlaybookMarkdown([], 'Java 后端', '2026-06-18T09:00:00.000Z')

    expect(markdown).toContain('# Java 后端 真实面试场景包')
    expect(markdown).toContain('暂无面试场景组')
    expect(markdown).toContain('入口：/practice')
    expect(markdown).not.toContain('undefined')
  })

  it('exports a personalized pressure queue from local study progress', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress('2026-06-18T09:00:00.000Z'),
      questionStates: {
        2: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00.000Z' },
        3: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-17T09:00:00.000Z' },
        4: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 3,
          lastEncounteredAt: '2026-06-18T08:00:00.000Z',
        },
      },
      questionSnapshots: {
        2: {
          id: 2,
          title: 'ThreadLocal 内存泄漏怎么排查？',
          difficulty: 'HARD',
          categoryName: 'Java 并发',
          tags: ['ThreadLocal'],
          viewCount: 120,
        },
        3: {
          id: 3,
          title: 'Redis 缓存一致性如何设计？',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['缓存'],
          viewCount: 98,
        },
        4: {
          id: 4,
          title: 'JVM Full GC 排查步骤？',
          difficulty: 'HARD',
          categoryName: 'JVM',
          tags: ['GC'],
          viewCount: 88,
        },
      },
      interviewAttempts: {
        3: [{
          questionId: 3,
          answer: '先说缓存，再补一致性。',
          feedback: {
            score: 58,
            level: 'needs-work',
            criteria: [
              { key: 'risk', label: '风险意识', score: 50, summary: '缺少失败兜底' },
            ],
            advice: ['补并发写和降级方案'],
            followUps: ['双写失败怎么办？'],
          },
          createdAt: '2026-06-18T08:30:00.000Z',
        }],
      },
      dailyPlan: [2, 3],
    }

    const markdown = buildExperiencePlaybookMarkdown(sets, 'Java 后端', '2026-06-18T09:00:00.000Z', progress)
    const queue = buildExperiencePressureQueue(progress)

    expect(markdown).toContain('## 个人押题队列')
    expect(markdown).toContain('ThreadLocal 内存泄漏怎么排查？')
    expect(markdown).toContain('Redis 缓存一致性如何设计？')
    expect(markdown).toContain('JVM Full GC 排查步骤？')
    expect(markdown).toContain('薄弱题')
    expect(markdown).toContain('模拟 58 分')
    expect(markdown).toContain('多次遇见')
    expect(markdown).toContain('面试官追问：请用一个真实项目说明「ThreadLocal 内存泄漏怎么排查？」的触发场景、排查证据和失败边界。')
    expect(markdown).toContain('面试官追问：Redis 缓存一致性如何设计？最近模拟 58 分，最低维度是「风险意识」50 分，你会怎么补证据和兜底？')
    expect(markdown).toContain('面试官追问：JVM Full GC 排查步骤？已经多次遇见但还没有复述记录，请先脱稿讲 60 秒。')
    expect(markdown).toContain('通过口径：能在 60 秒内讲清结论、项目证据、失败边界和下一步兜底。')
    expect(markdown).toContain('通过口径：能正面回应最低分维度，并补一个可追问的指标、边界或降级方案。')
    expect(markdown).toContain('/practice?queue=2,3,4&from=experience-playbook')
    expect(markdown).toContain('单题训练入口：/practice?queue=2&from=experience-playbook')
    expect(queue.items[0]).toMatchObject({
      questionId: 2,
      practicePath: '/practice?queue=2&from=experience-playbook',
    })
  })
})
