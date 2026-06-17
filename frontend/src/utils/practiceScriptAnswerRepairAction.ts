import type {
  InterviewAttempt,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'
import {
  analyzePracticeScriptAnswerAcceptance,
  type PracticeScriptAnswerAcceptanceItemKey,
} from './practiceScriptAnswerAcceptance'

export type PracticeScriptAnswerRepairActionKey =
  | PracticeScriptAnswerAcceptanceItemKey
  | 'insert-prompt'
  | 'compress'

export interface PracticeScriptAnswerRepairAction {
  key: PracticeScriptAnswerRepairActionKey
  label: string
  description: string
  template: string
}

interface ParsedFollowUpDraft {
  prompt: string
  answer: string
}

const actionLabels: Record<PracticeScriptAnswerRepairActionKey, string> = {
  direct: '补正面回应',
  evidence: '补项目证据',
  pressure: '补压力点',
  criterion: '补维度要求',
  'insert-prompt': '先带入追问',
  compress: '压缩 45 秒版',
}

/**
 * 根据追问回答验收结果生成一键修复模板，让用户能把缺口直接转成可编辑补答草稿。
 *
 * @param question 当前练习题
 * @param attempts 当前题历史模拟面试记录
 * @param answer 用户正在编辑的回答草稿
 * @returns 当前最优先的追问回答修复动作
 */
export function buildPracticeScriptAnswerRepairAction(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
  answer: string,
): PracticeScriptAnswerRepairAction {
  const parsed = parseFollowUpDraft(answer)

  if (!parsed) {
    return {
      key: 'insert-prompt',
      label: actionLabels['insert-prompt'],
      description: '当前还不是追问草稿，先从本题面试官脚本带入一个追问。',
      template: [
        '请先从本题面试官脚本选择一个追问，再点击修复。',
        '',
        '当前草稿保留：',
        sanitizeText(answer, '暂无原回答'),
      ].join('\n'),
    }
  }

  const acceptance = analyzePracticeScriptAnswerAcceptance(question, attempts, answer)
  const missing = acceptance.items.find(item => !item.covered)
  const key: PracticeScriptAnswerRepairActionKey = missing?.key ?? 'compress'

  return {
    key,
    label: actionLabels[key],
    description: resolveDescription(key, acceptance.criterionLabel),
    template: buildRepairTemplate(parsed, key, acceptance.criterionLabel),
  }
}

function buildRepairTemplate(
  parsed: ParsedFollowUpDraft,
  key: PracticeScriptAnswerRepairActionKey,
  criterionLabel = '当前维度',
): string {
  const prompt = sanitizeText(parsed.prompt, '当前追问')
  const originalAnswer = sanitizeText(parsed.answer, '暂无原回答')

  if (key === 'compress') {
    return [
      `追问：${prompt}`,
      '',
      '我的回答：',
      '原回答保留：',
      originalAnswer,
      '',
      '请把这段追问回答压缩成 45 秒版本：',
      '1. 第一句直接回应面试官追问。',
      '2. 只保留 1 个最关键证据或项目指标。',
      '3. 补 1 句压力点、风险或取舍理由。',
      '4. 最后用一句话收束到清晰选择。',
    ].join('\n')
  }

  return [
    `追问：${prompt}`,
    '',
    '我的回答：',
    '原回答保留：',
    originalAnswer,
    '',
    '请按下面结构补齐：',
    '正面回应：',
    directPrompt(key),
    '',
    '项目证据：',
    evidencePrompt(key),
    '',
    '压力点：',
    pressurePrompt(key),
    '',
    '维度补强：',
    criterionPrompt(key, criterionLabel),
  ].join('\n')
}

function directPrompt(key: PracticeScriptAnswerRepairActionKey): string {
  if (key === 'direct') {
    return '先用一句话正面回答面试官追问，不要先铺垫背景。'
  }
  return '保留已有结论，并把第一句话改得更直接。'
}

function evidencePrompt(key: PracticeScriptAnswerRepairActionKey): string {
  if (key === 'evidence') {
    return '补一个项目动作，并说明触发条件、指标、验证方式。'
  }
  return '保留已有项目或指标证据，删掉不能被追问验证的泛泛表达。'
}

function pressurePrompt(key: PracticeScriptAnswerRepairActionKey): string {
  if (key === 'pressure') {
    return '说明面试官真正追的是什么，并补风险、取舍、反问或边界回应。'
  }
  return '补一句压力点回应，证明你不是只背主答案。'
}

function criterionPrompt(key: PracticeScriptAnswerRepairActionKey, criterionLabel: string): string {
  if (key === 'criterion') {
    return `围绕「${criterionLabel}」补 1 到 2 句，让回答命中当前脚本维度。`
  }
  return `检查「${criterionLabel}」是否已经被明确说出，必要时补一句。`
}

function resolveDescription(key: PracticeScriptAnswerRepairActionKey, criterionLabel?: string): string {
  if (key === 'direct') {
    return '当前追问回答缺少第一句正面回应。'
  }
  if (key === 'evidence') {
    return '当前追问回答缺少项目动作、指标或验证方式。'
  }
  if (key === 'pressure') {
    return '当前追问回答还没有回应面试官的加压点。'
  }
  if (key === 'criterion') {
    return `当前追问回答还没有补齐${criterionLabel ?? '脚本'}维度。`
  }
  if (key === 'compress') {
    return '追问回答已经过验收，继续压缩成更适合口述的版本。'
  }
  return '先带入追问，再生成补答模板。'
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

function sanitizeText(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || fallback
}
