import type { InterviewAttempt, PracticeQueueItem, QuestionSnapshot } from '../types'
import {
  buildPracticeInterviewerScript,
  type PracticeInterviewerScript,
  type PracticeInterviewerScriptStep,
} from './practiceInterviewerScript'
import { analyzePracticeScriptAnswerAcceptance } from './practiceScriptAnswerAcceptance'

export type PracticeInterviewerScriptStepStatus = 'pending' | 'attempted' | 'passed'

export interface PracticeInterviewerScriptProgressStep {
  step: PracticeInterviewerScriptStep
  status: PracticeInterviewerScriptStepStatus
  attemptCount: number
  latestAttemptAt?: string
  acceptanceScore?: number
}

export interface PracticeInterviewerScriptProgress {
  script: PracticeInterviewerScript
  totalSteps: number
  passedCount: number
  attemptedCount: number
  progressPercent: number
  summary: string
  nextStep?: PracticeInterviewerScriptStep
  steps: PracticeInterviewerScriptProgressStep[]
}

interface ParsedFollowUpAnswer {
  prompt: string
  answer: string
}

const stepStatusLabels: Record<PracticeInterviewerScriptStepStatus, string> = {
  pending: '待练',
  attempted: '修复中',
  passed: '已通过',
}

/**
 * 汇总本题面试官脚本的逐问练习进度。
 *
 * @param question 当前练习题
 * @param attempts 当前题历史模拟面试记录
 * @returns 脚本、逐问状态和下一步建议
 */
export function buildPracticeInterviewerScriptProgress(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
): PracticeInterviewerScriptProgress {
  // 追问回答是脚本内训练结果，不应该参与脚本阶段判定，否则一次追问得分会把预热脚本误切到进阶脚本。
  const baseAttempts = attempts.filter(attempt => !parseFollowUpAnswer(attempt.answer))
  const script = buildPracticeInterviewerScript(question, baseAttempts)
  const followUpAttempts = attempts
    .map(attempt => ({ attempt, parsed: parseFollowUpAnswer(attempt.answer) }))
    .filter((item): item is { attempt: InterviewAttempt; parsed: ParsedFollowUpAnswer } => Boolean(item.parsed))
    .sort((a, b) => timestampOf(b.attempt.createdAt) - timestampOf(a.attempt.createdAt))

  const steps = script.steps.map(step => buildStepProgress(question, baseAttempts, followUpAttempts, step))
  const passedCount = steps.filter(step => step.status === 'passed').length
  const attemptedCount = steps.filter(step => step.status === 'attempted').length
  const nextStep = steps.find(step => step.status !== 'passed')?.step

  return {
    script,
    totalSteps: steps.length,
    passedCount,
    attemptedCount,
    progressPercent: steps.length > 0 ? Math.round((passedCount / steps.length) * 100) : 0,
    summary: buildSummary(passedCount, attemptedCount, nextStep),
    nextStep,
    steps,
  }
}

/**
 * 生成本题面试官脚本进度复盘 Markdown。
 *
 * @param question 当前练习题
 * @param attempts 当前题历史模拟面试记录
 * @param now 生成时间
 * @returns 可复制或下载的 Markdown 复盘内容
 */
export function buildPracticeInterviewerScriptProgressMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
  now = new Date().toISOString(),
): string {
  const progress = buildPracticeInterviewerScriptProgress(question, attempts)

  return [
    `# ${question.title} 本题面试官脚本进度`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    `分类：${question.categoryName || '未分类'}`,
    `难度：${question.difficulty || '未知'}`,
    '',
    '## 进度概览',
    `- 脚本阶段：${progress.script.title}`,
    `- 脚本进度：${progress.passedCount} / ${progress.totalSteps}（${progress.progressPercent}%）`,
    `- 下一步：${progress.summary}`,
    '',
    '## 逐问状态',
    ...renderProgressSteps(progress.steps),
    '',
    '## 复盘建议',
    `- ${resolveReviewAdvice(progress)}`,
  ].join('\n').trimEnd()
}

function buildStepProgress(
  question: PracticeQueueItem | QuestionSnapshot,
  baseAttempts: InterviewAttempt[],
  followUpAttempts: Array<{ attempt: InterviewAttempt; parsed: ParsedFollowUpAnswer }>,
  step: PracticeInterviewerScriptStep,
): PracticeInterviewerScriptProgressStep {
  const matchingAttempts = followUpAttempts.filter(item => promptsMatch(item.parsed.prompt, step.prompt))
  const latest = matchingAttempts[0]

  if (!latest) {
    return {
      step,
      status: 'pending',
      attemptCount: 0,
    }
  }

  const acceptance = analyzePracticeScriptAnswerAcceptance(question, baseAttempts, latest.attempt.answer)

  return {
    step,
    status: acceptance.level === 'passed' ? 'passed' : 'attempted',
    attemptCount: matchingAttempts.length,
    latestAttemptAt: latest.attempt.createdAt,
    acceptanceScore: acceptance.score,
  }
}

function buildSummary(
  passedCount: number,
  attemptedCount: number,
  nextStep?: PracticeInterviewerScriptStep,
): string {
  if (!nextStep) {
    return '三问均已通过，可以重练或导出脚本。'
  }

  if (attemptedCount > 0) {
    return '继续修复当前未通过追问，通过后再进入下一问。'
  }

  if (passedCount > 0) {
    return '下一问已标出，继续完成未通过追问。'
  }

  return '从第 1 问开始完成本题面试官脚本，下一问已标出。'
}

function renderProgressSteps(steps: PracticeInterviewerScriptProgressStep[]): string[] {
  if (steps.length === 0) {
    return ['- 暂无脚本步骤，请先完成一次模拟面试。']
  }

  return steps.map((item, index) => [
    `${index + 1}. ${item.step.title}`,
    `   - 状态：${stepStatusLabels[item.status]}`,
    `   - 维度：${item.step.criterionLabel}`,
    `   - 验收分：${item.acceptanceScore ?? '暂无'}`,
    `   - 最近练习：${item.latestAttemptAt ? formatMarkdownDate(item.latestAttemptAt) : '暂无'}`,
    `   - 追问：${item.step.prompt}`,
    `   - 修复动作：${resolveStepAction(item.status)}`,
  ].join('\n'))
}

function resolveStepAction(status: PracticeInterviewerScriptStepStatus): string {
  if (status === 'passed') {
    return '已通过，可以重练保持手感。'
  }
  if (status === 'attempted') {
    return '继续修复当前追问，补齐缺失证据后再提交评分。'
  }
  return '先带入回答框完成这一问。'
}

function resolveReviewAdvice(progress: PracticeInterviewerScriptProgress): string {
  if (progress.passedCount === progress.totalSteps && progress.totalSteps > 0) {
    return '本题追问脚本已完成，建议把高分回答沉淀到复盘笔记。'
  }
  if (progress.attemptedCount > 0) {
    return '优先处理修复中的追问，避免同一题反复停在半通过状态。'
  }
  return '先完成第一问，建立这道题的结论、机制和场景表达骨架。'
}

function parseFollowUpAnswer(rawAnswer: string): ParsedFollowUpAnswer | null {
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

function promptsMatch(actualPrompt: string, expectedPrompt: string): boolean {
  const actual = normalize(actualPrompt)
  const expected = normalize(expectedPrompt)

  return actual === expected || actual.includes(expected) || expected.includes(actual)
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function timestampOf(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}
