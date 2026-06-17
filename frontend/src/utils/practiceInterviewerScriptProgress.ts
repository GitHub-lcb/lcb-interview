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
