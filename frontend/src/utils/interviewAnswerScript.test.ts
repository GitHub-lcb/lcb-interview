import { describe, expect, it } from 'vitest'
import {
  buildInterviewAnswerScript,
  buildInterviewAnswerScriptMarkdown,
  buildInterviewAnswerSpeechText,
} from './interviewAnswerScript'
import type { Question } from '../types'

const question = (overrides: Partial<Question> = {}): Question => ({
  id: 7,
  title: 'HashMap 为什么线程不安全？',
  summary: 'HashMap 在并发写入时没有同步保护，可能出现数据覆盖、链表或树结构异常。',
  content: 'HashMap 的 put、resize 都不是线程安全的，并发下需要使用 ConcurrentHashMap。',
  principle: '扩容迁移、桶位写入和节点链接都缺少互斥保护。',
  scenario: '读多写少可以外部加锁，频繁并发写应使用 ConcurrentHashMap。',
  risk: '不要把 HashMap 包一层 volatile 当成线程安全方案。',
  projectExp: '项目缓存聚合场景中，用 ConcurrentHashMap 承接热点 key 的并发写入。',
  comparison: '',
  codeExamples: '',
  diagrams: '',
  difficulty: 'MEDIUM',
  categoryName: 'Java 集合',
  categoryId: 2,
  tags: ['HashMap', '并发'],
  viewCount: 120,
  createTime: '2026-06-20T00:00:00.000Z',
  ...overrides,
})

describe('interviewAnswerScript', () => {
  it('compresses a question into a 60 second interview script', () => {
    const script = buildInterviewAnswerScript(question())

    expect(script.opening).toContain('HashMap 在并发写入时没有同步保护')
    expect(script.keyPoints).toEqual([
      expect.objectContaining({ label: '机制', text: '扩容迁移、桶位写入和节点链接都缺少互斥保护。' }),
      expect.objectContaining({ label: '场景', text: '读多写少可以外部加锁，频繁并发写应使用 ConcurrentHashMap。' }),
      expect.objectContaining({ label: '落地', text: '项目缓存聚合场景中，用 ConcurrentHashMap 承接热点 key 的并发写入。' }),
    ])
    expect(script.riskLine).toBe('不要把 HashMap 包一层 volatile 当成线程安全方案。')
    expect(script.followUps).toHaveLength(3)
  })

  it('exports portable markdown without undefined placeholders', () => {
    const markdown = buildInterviewAnswerScriptMarkdown(question({ projectExp: undefined }), '2026-06-20T00:00:00.000Z')

    expect(markdown).toContain('# HashMap 为什么线程不安全？ 60 秒面试口径')
    expect(markdown).toContain('生成时间：2026-06-20')
    expect(markdown).toContain('## 开场口径')
    expect(markdown).toContain('## 三段展开')
    expect(markdown).toContain('## 误区防线')
    expect(markdown).toContain('## 面试官追问')
    expect(markdown).toContain('落地')
    expect(markdown).not.toContain('undefined')
  })

  it('builds a clean speech script for oral rehearsal', () => {
    const speechText = buildInterviewAnswerSpeechText(question({
      principle: '### 机制\n扩容迁移和节点链接都缺少互斥保护。',
    }))

    expect(speechText).toContain('题目，HashMap 为什么线程不安全？')
    expect(speechText).toContain('开场，HashMap 在并发写入时没有同步保护')
    expect(speechText).toContain('机制，机制 扩容迁移和节点链接都缺少互斥保护。')
    expect(speechText).toContain('误区防线，不要把 HashMap 包一层 volatile 当成线程安全方案。')
    expect(speechText).toContain('追问预演')
    expect(speechText).not.toContain('#')
    expect(speechText).not.toContain('undefined')
  })
})
