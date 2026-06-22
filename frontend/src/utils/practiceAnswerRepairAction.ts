import type { PracticeQueueItem, QuestionSnapshot } from '../types'
import {
  analyzePracticeAnswerReadiness,
  type PracticeAnswerReadinessItemKey,
} from './practiceAnswerReadiness'

export type PracticeAnswerRepairActionKey = PracticeAnswerReadinessItemKey | 'compress'

export interface PracticeAnswerRepairAction {
  key: PracticeAnswerRepairActionKey
  label: string
  description: string
  template: string
}

const ACTION_LABELS: Record<PracticeAnswerRepairActionKey, string> = {
  conclusion: '补第一句结论',
  mechanism: '补核心机制',
  scenario: '补项目场景',
  risk: '补边界风险',
  compress: '压缩 60 秒版',
}

/**
 * 根据实时结构检查结果生成一键修复动作，让用户能把缺口直接转成可编辑重答草稿。
 *
 * @param question 当前练习题目
 * @param answer 用户正在编辑的回答草稿
 * @returns 当前最优先修复动作
 */
export function buildPracticeAnswerRepairAction(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
): PracticeAnswerRepairAction {
  const readiness = analyzePracticeAnswerReadiness(question, answer)
  const missing = readiness.items.find(item => !item.covered)
  const key: PracticeAnswerRepairActionKey = missing?.key ?? 'compress'

  return {
    key,
    label: ACTION_LABELS[key],
    description: resolveDescription(key),
    template: buildRepairTemplate(question, answer, key),
  }
}

function buildRepairTemplate(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  key: PracticeAnswerRepairActionKey,
): string {
  const title = sanitizeText(question.title, '当前题目')
  const originalAnswer = sanitizeText(answer, '暂无原回答')

  if (key === 'compress') {
    return [
      '原回答保留：',
      originalAnswer,
      '',
      '请把这段回答压缩成 60 秒版本：',
      `1. 用第一句话回答「${title}」的核心结论。`,
      '2. 只保留 2 个最关键机制。',
      '3. 用 1 个项目/线上场景证明你能落地。',
      '4. 最后用 1 句说明边界风险或兜底策略。',
    ].join('\n')
  }

  return [
    '原回答保留：',
    originalAnswer,
    '',
    '请按下面结构重答：',
    '结论：',
    conclusionPrompt(title, key),
    '',
    '机制：',
    mechanismPrompt(key),
    '',
    '场景：',
    scenarioPrompt(key),
    '',
    '边界：',
    riskPrompt(key),
  ].join('\n')
}

function conclusionPrompt(title: string, key: PracticeAnswerRepairActionKey): string {
  if (key === 'conclusion') {
    return `请先明确回答「${title}」：...`
  }
  return `保留原结论，并把「${title}」的核心判断讲得更直接。`
}

function mechanismPrompt(key: PracticeAnswerRepairActionKey): string {
  if (key === 'mechanism') {
    return '请补 2 到 3 个核心机制、关键名词或执行链路。'
  }
  return '保留已有机制，并删掉和题目无关的铺垫。'
}

function scenarioPrompt(key: PracticeAnswerRepairActionKey): string {
  if (key === 'scenario') {
    return '请补一个线上/项目场景，说明触发条件、处理动作和验证指标。'
  }
  return '补一个能证明你做过或理解落地的项目/线上场景。'
}

function riskPrompt(key: PracticeAnswerRepairActionKey): string {
  if (key === 'risk') {
    return '请补适用边界、失败场景、常见误区或兜底方案。'
  }
  return '最后补一句边界风险，避免回答停留在理想路径。'
}

function resolveDescription(key: PracticeAnswerRepairActionKey): string {
  if (key === 'conclusion') {
    return '当前回答缺少开场判断，先把第一句话说稳。'
  }
  if (key === 'mechanism') {
    return '当前回答缺少原理链路，先补能证明理解的机制。'
  }
  if (key === 'scenario') {
    return '当前回答缺少项目语境，补场景会更像真实面试表达。'
  }
  if (key === 'risk') {
    return '当前回答缺少边界意识，补风险能减少追问失分。'
  }
  return '四段结构已覆盖，继续压缩成更适合口述的版本。'
}

function sanitizeText(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || fallback
}
