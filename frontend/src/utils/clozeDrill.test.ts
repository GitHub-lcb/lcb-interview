import { describe, expect, it } from 'vitest'
import { buildClozeDrill, checkClozeAnswers } from './clozeDrill'
import type { Question } from '../types'

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    title: '什么是 Redis 持久化',
    content: '',
    difficulty: 'MEDIUM',
    categoryName: 'Redis',
    tags: [],
    viewCount: 100,
    createTime: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildClozeDrill', () => {
  it('优先使用 summary 且生成空位', () => {
    const question = makeQuestion({
      summary: 'Redis 持久化通过 RDB 快照和 AOF 日志两种机制保证数据落盘，RDB 是全量快照，AOF 记录每条写命令增量追加。',
    })
    const drill = buildClozeDrill(question)
    expect(drill).not.toBeNull()
    expect(drill!.sourceLabel).toBe('30 秒口径')
    expect(drill!.maskedText).toContain('______')
    expect(drill!.blanks.length).toBeGreaterThan(0)
    expect(drill!.blanks.length).toBeLessThanOrEqual(6)
  })

  it('summary 太短时回退到 content 第一段', () => {
    const question = makeQuestion({
      summary: '太短',
      content: 'HashMap 在 JDK 1.8 之后采用数组加链表加红黑树的结构，当链表长度超过 8 且数组容量大于等于 64 时会转换为红黑树，从而把最坏查询复杂度从 O(n) 降到 O(log n)。',
    })
    const drill = buildClozeDrill(question)
    expect(drill).not.toBeNull()
    expect(drill!.sourceLabel).toBe('标准回答')
  })

  it('空位总数不超过上限 6', () => {
    const question = makeQuestion({
      summary: 'MySQL 索引覆盖聚簇索引、二级索引、联合索引、唯一索引、全文索引、前缀索引、空间索引等多种类型，各自适用不同场景。',
    })
    const drill = buildClozeDrill(question)
    expect(drill!.blanks.length).toBeLessThanOrEqual(6)
  })

  it('无可用文本时返回 null', () => {
    expect(buildClozeDrill(makeQuestion())).toBeNull()
    expect(buildClozeDrill(makeQuestion({ summary: 'x' }))).toBeNull()
  })
})

describe('checkClozeAnswers', () => {
  const question = makeQuestion({
    summary: 'Redis 持久化通过 RDB 快照和 AOF 日志两种机制保证数据落盘。',
  })
  const drill = buildClozeDrill(question)!

  it('全部答对得满分', () => {
    const result = checkClozeAnswers(drill, drill.blanks.map(blank => blank.answer))
    expect(result.score).toBe(100)
    expect(result.correct).toBe(result.total)
  })

  it('大小写不敏感且忽略首尾空格', () => {
    const result = checkClozeAnswers(drill, drill.blanks.map(blank => ` ${blank.answer.toUpperCase()} `))
    // 中文词大小写转换无影响；英文词全部转大写后应判定为正确
    expect(result.score).toBe(100)
  })

  it('未作答计为错误并保留 actual 供展示', () => {
    const result = checkClozeAnswers(drill, drill.blanks.map(() => ''))
    expect(result.score).toBe(0)
    expect(result.details.every(detail => !detail.correct && detail.actual === '')).toBe(true)
  })

  it('英文允许单复数互换', () => {
    const single = makeQuestion({
      summary: 'Redis 集群通过 slot 分片机制把数据分布到多个节点，每个节点负责一部分哈希槽位。',
    })
    const drillSingle = buildClozeDrill(single)!
    const answers = drillSingle.blanks.map(blank => blank.answer.replace(/s$/i, ''))
    const result = checkClozeAnswers(drillSingle, answers)
    expect(result.score).toBe(100)
  })
})
