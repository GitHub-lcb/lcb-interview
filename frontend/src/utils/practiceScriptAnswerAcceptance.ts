import type {
  FollowUpDrillCriterionKey,
  InterviewAttempt,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'
import {
  buildPracticeInterviewerScript,
  type PracticeInterviewerScriptStep,
} from './practiceInterviewerScript'

export type PracticeScriptAnswerAcceptanceLevel = 'idle' | 'empty' | 'draft' | 'ready' | 'passed'
export type PracticeScriptAnswerAcceptanceItemKey = 'direct' | 'evidence' | 'pressure' | 'criterion'

export interface PracticeScriptAnswerAcceptanceItem {
  key: PracticeScriptAnswerAcceptanceItemKey
  label: string
  covered: boolean
  evidence: string
  guidance: string
}

export interface PracticeScriptAnswerAcceptance {
  score: number
  level: PracticeScriptAnswerAcceptanceLevel
  title: string
  summary: string
  nextAction: string
  matchedPrompt?: string
  criterionLabel?: string
  items: PracticeScriptAnswerAcceptanceItem[]
}

interface ParsedFollowUpDraft {
  prompt: string
  answer: string
}

const itemLabels: Record<PracticeScriptAnswerAcceptanceItemKey, string> = {
  direct: '正面回应',
  evidence: '可追问证据',
  pressure: '压力点覆盖',
  criterion: '维度要求',
}

const conclusionMarkers = ['结论', '首先', '第一', '我认为', '核心是', '本质是', '答案是']
const evidenceMarkers = [
  '项目',
  '线上',
  '生产',
  '故障',
  '指标',
  '数据',
  '验证',
  '压测',
  '吞吐',
  '错误率',
  '耗时',
  '监控',
  '复盘',
  '容量',
]
const pressureMarkers = [
  '面试官',
  '追问',
  '压力',
  '取舍',
  '反问',
  '误区',
  '失败',
  '边界',
  '风险',
  '兜底',
  '替代',
  '选择',
]

const criterionMarkers: Record<FollowUpDrillCriterionKey, string[]> = {
  coverage: ['定义', '机制', '原理', '因为', '导致', '替代方案', '核心原因'],
  structure: ['结论', '原因', '场景', '边界', '顺序', '第一', '第二'],
  specificity: ['项目', '线上', '指标', '触发条件', '验证', '动作', '监控', '压测'],
  risk: ['风险', '边界', '失败', '兜底', '降级', '误区', '替代方案', '影响范围'],
  advanced: ['方案', '对比', '取舍', '选择', '优点', '缺点', '权衡'],
}

/**
 * 验收当前回答草稿是否真正回应了本题面试官脚本里的追问。
 *
 * @param question 当前练习题
 * @param attempts 当前题历史模拟面试记录
 * @param rawAnswer 用户正在编辑的回答草稿
 * @returns 追问回答的本地实时验收结果
 */
export function analyzePracticeScriptAnswerAcceptance(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
  rawAnswer: string,
): PracticeScriptAnswerAcceptance {
  const parsed = parseFollowUpDraft(rawAnswer)
  const script = buildPracticeInterviewerScript(question, attempts)
  const idleItems = buildItems()

  if (!parsed) {
    return {
      score: 0,
      level: 'idle',
      title: '等待追问回答',
      summary: '从本题面试官脚本带入追问后，这里会检查回答是否真正命中追问。',
      nextAction: '先从本题面试官脚本选择追问',
      items: idleItems,
    }
  }

  const matchedStep = findMatchingStep(script.steps, parsed.prompt)
  const criterionKey = matchedStep?.criterionKey ?? 'advanced'
  const criterionLabel = matchedStep?.criterionLabel ?? '通用追问'

  if (!parsed.answer.trim()) {
    return {
      score: 0,
      level: 'empty',
      title: '追问已带入',
      summary: matchedStep
        ? '已经识别到本题面试官脚本追问，先写出回答正文再提交评分。'
        : '当前追问未匹配本题面试官脚本，建议从脚本按钮带入追问以获得更精准验收。',
      nextAction: '先写出追问回答',
      matchedPrompt: matchedStep?.prompt,
      criterionLabel,
      items: idleItems,
    }
  }

  const answer = parsed.answer.trim()
  const normalizedAnswer = normalize(answer)
  const promptSignals = extractSignals([parsed.prompt, matchedStep?.title ?? '', question.title, ...question.tags])
  const pressureSignals = extractSignals([
    matchedStep?.pressurePoint ?? '',
    matchedStep?.answerHint ?? '',
  ])
  const items = buildItems({
    direct: hasAnySignal(normalizedAnswer, [...promptSignals, ...conclusionMarkers]),
    evidence: hasAnySignal(normalizedAnswer, evidenceMarkers),
    pressure: hasAnySignal(normalizedAnswer, [...pressureSignals, ...pressureMarkers]),
    criterion: hasAnySignal(normalizedAnswer, criterionMarkers[criterionKey]),
  })
  const coveredCount = items.filter(item => item.covered).length
  const score = coveredCount * 25
  const level = resolveLevel(score, coveredCount)

  return {
    score,
    level,
    title: resolveTitle(level),
    summary: matchedStep
      ? `已按「${criterionLabel}」验收当前追问回答。`
      : '当前追问未匹配本题面试官脚本，仍按通用追问验收；建议从脚本按钮带入追问更精准。',
    nextAction: resolveNextAction(items),
    matchedPrompt: matchedStep?.prompt,
    criterionLabel,
    items,
  }
}

function parseFollowUpDraft(rawAnswer: string): ParsedFollowUpDraft | null {
  const followUpIndex = rawAnswer.indexOf('追问：')
  if (followUpIndex < 0) {
    return null
  }

  const content = rawAnswer.slice(followUpIndex + '追问：'.length)
  const answerMarker = '我的回答：'
  const markerIndex = content.indexOf(answerMarker)

  if (markerIndex < 0) {
    return {
      prompt: content.trim(),
      answer: '',
    }
  }

  return {
    prompt: content.slice(0, markerIndex).trim(),
    answer: content.slice(markerIndex + answerMarker.length).trim(),
  }
}

function findMatchingStep(
  steps: PracticeInterviewerScriptStep[],
  prompt: string,
): PracticeInterviewerScriptStep | undefined {
  const normalizedPrompt = normalize(prompt)
  return steps.find(step => {
    const normalizedStepPrompt = normalize(step.prompt)
    return normalizedStepPrompt === normalizedPrompt
      || normalizedStepPrompt.includes(normalizedPrompt)
      || normalizedPrompt.includes(normalizedStepPrompt)
  })
}

function buildItems(
  covered: Partial<Record<PracticeScriptAnswerAcceptanceItemKey, boolean>> = {},
): PracticeScriptAnswerAcceptanceItem[] {
  return [
    buildItem('direct', covered.direct, '已正面回应追问主题', '先正面回答面试官问题'),
    buildItem('evidence', covered.evidence, '已补项目、指标或验证证据', '补项目动作、指标或验证方式'),
    buildItem('pressure', covered.pressure, '已回应脚本压力点', '回应脚本压力点'),
    buildItem('criterion', covered.criterion, '已命中当前维度要求', '补齐当前维度要求'),
  ]
}

function buildItem(
  key: PracticeScriptAnswerAcceptanceItemKey,
  covered = false,
  evidence: string,
  guidance: string,
): PracticeScriptAnswerAcceptanceItem {
  return {
    key,
    label: itemLabels[key],
    covered,
    evidence,
    guidance,
  }
}

function resolveLevel(score: number, coveredCount: number): PracticeScriptAnswerAcceptanceLevel {
  if (score >= 75 && coveredCount === 4) {
    return 'passed'
  }
  if (score >= 50) {
    return 'ready'
  }
  return 'draft'
}

function resolveTitle(level: PracticeScriptAnswerAcceptanceLevel): string {
  if (level === 'passed') {
    return '追问回答已过验收'
  }
  if (level === 'ready') {
    return '追问回答基本可用'
  }
  return '追问回答还缺关键证据'
}

function resolveNextAction(items: PracticeScriptAnswerAcceptanceItem[]): string {
  const missing = items.find(item => !item.covered)
  return missing?.guidance ?? '可以提交评分'
}

function extractSignals(values: string[]): string[] {
  return [...new Set(
    values
      .join(' ')
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .flatMap(splitChineseSignal)
      .map(normalize)
      .filter(signal => signal.length >= 2),
  )].slice(0, 18)
}

function splitChineseSignal(value: string): string[] {
  const normalized = normalize(value)
  if (/^[\u4e00-\u9fa5]+$/.test(normalized) && normalized.length > 8) {
    return [normalized, normalized.slice(0, 4), normalized.slice(-4)]
  }
  return [normalized]
}

function hasAnySignal(normalizedAnswer: string, signals: string[]): boolean {
  return signals.map(normalize).some(signal => signal && normalizedAnswer.includes(signal))
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}
