import type { PracticeQueueItem, QuestionSnapshot } from '../types'

export type PracticeAnswerReadinessLevel = 'empty' | 'draft' | 'ready' | 'sharp'
export type PracticeAnswerReadinessItemKey = 'conclusion' | 'mechanism' | 'scenario' | 'risk'

export interface PracticeAnswerReadinessItem {
  key: PracticeAnswerReadinessItemKey
  label: string
  covered: boolean
  evidence: string
  guidance: string
}

export interface PracticeAnswerReadiness {
  score: number
  level: PracticeAnswerReadinessLevel
  title: string
  summary: string
  nextAction: string
  items: PracticeAnswerReadinessItem[]
}

const ITEM_LABELS: Record<PracticeAnswerReadinessItemKey, string> = {
  conclusion: '结论',
  mechanism: '机制',
  scenario: '场景',
  risk: '边界',
}

const CONCLUSION_MARKERS = ['结论', '首先', '第一', '我认为', '核心是', '本质是', '答案是']
const MECHANISM_MARKERS = ['机制', '原理', '底层', '链路', '流程', '因为', '导致', '关键', '扩容', '并发']
const SCENARIO_MARKERS = ['场景', '项目', '线上', '生产', '高并发', '例如', '比如', '实践', '落地']
const RISK_MARKERS = ['风险', '边界', '注意', '不能', '缺点', '误区', '兜底', '降级', '替代', '只适合']

/**
 * 分析模拟面试回答草稿是否具备提交前的基础结构。
 *
 * @param question 当前练习题目
 * @param rawAnswer 用户正在编辑的回答草稿
 * @returns 结论、机制、场景、边界四段的实时检查结果
 */
export function analyzePracticeAnswerReadiness(
  question: PracticeQueueItem | QuestionSnapshot,
  rawAnswer: string,
): PracticeAnswerReadiness {
  const answer = rawAnswer.trim()
  const normalized = normalize(answer)
  const signals = extractQuestionSignals(question)
  const items: PracticeAnswerReadinessItem[] = [
    buildConclusionItem(answer, normalized, signals),
    buildMarkerItem('mechanism', normalized, MECHANISM_MARKERS, signals, '补核心原理、执行链路或题目关键词。'),
    buildMarkerItem('scenario', normalized, SCENARIO_MARKERS, [], '补一个线上/项目场景，说明触发条件、处理动作和验证指标。'),
    buildMarkerItem('risk', normalized, RISK_MARKERS, [], '补适用边界、失败场景、误区或兜底方案。'),
  ]
  const coveredCount = items.filter(item => item.covered).length
  const score = answer ? coveredCount * 25 : 0
  const level = resolveReadinessLevel(score, answer)

  return {
    score,
    level,
    title: resolveTitle(level),
    summary: resolveSummary(level, coveredCount),
    nextAction: resolveNextAction(items),
    items,
  }
}

function buildConclusionItem(
  answer: string,
  normalized: string,
  signals: string[],
): PracticeAnswerReadinessItem {
  const opening = normalize(answer.slice(0, 90))
  const markerHit = CONCLUSION_MARKERS.some(marker => normalized.includes(normalize(marker)))
  const keywordHit = signals.some(signal => signal.length >= 3 && opening.includes(signal))
  const covered = Boolean(answer) && (markerHit || keywordHit)

  return {
    key: 'conclusion',
    label: ITEM_LABELS.conclusion,
    covered,
    evidence: covered ? '已给出开场判断' : '还没有明确第一句结论',
    guidance: '先写出第一句结论，直接回答题目核心判断。',
  }
}

function buildMarkerItem(
  key: Exclude<PracticeAnswerReadinessItemKey, 'conclusion'>,
  normalized: string,
  markers: string[],
  extraSignals: string[],
  guidance: string,
): PracticeAnswerReadinessItem {
  const candidates = [...markers.map(normalize), ...extraSignals]
  const hit = candidates.find(marker => marker && normalized.includes(marker))

  return {
    key,
    label: ITEM_LABELS[key],
    covered: Boolean(hit),
    evidence: hit ? `已命中「${hit}」` : `还缺少${ITEM_LABELS[key]}表达`,
    guidance,
  }
}

function extractQuestionSignals(question: PracticeQueueItem | QuestionSnapshot): string[] {
  const rawSignals = [
    question.title,
    question.categoryName,
    ...question.tags,
  ].join(' ')

  return [...new Set(
    normalize(rawSignals)
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .flatMap(splitChineseSignal)
      .filter(signal => signal.length >= 2 && !['为什么', '是什么', '怎么', '如何'].includes(signal)),
  )].slice(0, 10)
}

function splitChineseSignal(value: string): string[] {
  if (/^[\u4e00-\u9fa5]+$/.test(value) && value.length > 6) {
    return [value, value.slice(0, 4), value.slice(-4)]
  }
  return [value]
}

function resolveReadinessLevel(score: number, answer: string): PracticeAnswerReadinessLevel {
  if (!answer.trim()) {
    return 'empty'
  }
  if (score >= 75) {
    return 'sharp'
  }
  if (score >= 50) {
    return 'ready'
  }
  return 'draft'
}

function resolveTitle(level: PracticeAnswerReadinessLevel): string {
  if (level === 'empty') {
    return '等待回答草稿'
  }
  if (level === 'draft') {
    return '草稿还缺主结构'
  }
  if (level === 'ready') {
    return '已有基础结构'
  }
  return '结构完整，可以提交'
}

function resolveSummary(level: PracticeAnswerReadinessLevel, coveredCount: number): string {
  if (level === 'empty') {
    return '回答为空，先用一句话给出核心判断。'
  }
  if (level === 'sharp') {
    return '结论、机制、场景和边界都已覆盖，适合进入正式评分。'
  }
  return `当前已覆盖 ${coveredCount} / 4 段，继续补齐缺口后再提交评分更稳。`
}

function resolveNextAction(items: PracticeAnswerReadinessItem[]): string {
  const missing = items.find(item => !item.covered)
  if (!missing) {
    return '可以提交评分'
  }
  if (missing.key === 'conclusion') {
    return '先写出第一句结论'
  }
  if (missing.key === 'mechanism') {
    return '补核心机制或题目关键词'
  }
  if (missing.key === 'scenario') {
    return '补一个线上/项目场景'
  }
  return '补一个边界风险或兜底方案'
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}
