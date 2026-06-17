import { describe, expect, it } from 'vitest'
import type { ExperienceSet } from '../data/freeSuperiority'
import { buildExperiencePlaybookMarkdown } from './experiencePlaybook'

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
})
