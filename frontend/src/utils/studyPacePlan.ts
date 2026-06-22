import type { Question, StudyProgress, StudyQuestionStatus } from '../types'
import { buildScheduledReviewQueue } from './reviewSchedule'
import { getQuestionState } from './studyProgress'
import { buildStudyPaceCoach } from './studyPaceCoach'

export function buildPaceFilledDailyPlan(
  progress: StudyProgress,
  candidates: Question[],
  now = new Date().toISOString(),
): number[] {
  const target = buildStudyPaceCoach(progress, now).dailyQuestionTarget
  const plan: number[] = []
  const used = new Set<number>()
  const pushQuestionId = (questionId: number) => {
    if (used.has(questionId) || plan.length >= target) {
      return
    }
    used.add(questionId)
    plan.push(questionId)
  }

  for (const questionId of progress.dailyPlan) {
    pushQuestionId(questionId)
  }

  // 补齐计划时先偿还到期复习债，避免为了新增题量牺牲记忆闭环。
  const reviewDebts = buildScheduledReviewQueue(progress, now, Math.max(target * 2, 12))
    .filter(item => item.dueStatus !== 'upcoming')
  for (const item of reviewDebts) {
    pushQuestionId(item.id)
  }

  const rankedCandidates = candidates
    .map((question, index) => ({ question, index }))
    .sort((a, b) => {
      const rankDiff = statusRank(getQuestionState(progress, a.question.id).status)
        - statusRank(getQuestionState(progress, b.question.id).status)
      if (rankDiff !== 0) {
        return rankDiff
      }
      return a.index - b.index
    })

  for (const item of rankedCandidates) {
    pushQuestionId(item.question.id)
  }

  return plan
}

function statusRank(status: StudyQuestionStatus): number {
  if (status === 'weak') {
    return 0
  }
  if (status === 'learning') {
    return 1
  }
  if (status === 'new') {
    return 2
  }
  return 3
}
