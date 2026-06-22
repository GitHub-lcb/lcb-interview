import type { StudyProgress } from '../types'
import { getQuestionState } from './studyProgress'

interface PracticeHandoffSourceOptions {
  replace?: boolean
}

const PRACTICE_HANDOFF_PATH_PATTERN = /\/practice\?[^\s)）]+/g
const PRACTICE_HANDOFF_TARGET_PATTERN = /[?&](queue|question)=/

export function buildDailyPracticePath(questionIds: number[], limit = 12, source?: string): string {
  const queue = [...new Set(questionIds)]
    .filter(questionId => Number.isInteger(questionId) && questionId > 0)
    .slice(0, Math.max(0, limit))

  if (queue.length === 0) {
    return '/practice'
  }

  const query = [
    `queue=${queue.join(',')}`,
    source ? `from=${encodeURIComponent(source)}` : '',
  ].filter(Boolean).join('&')

  return `/practice?${query}`
}

export function buildContinuePracticePath(progress: StudyProgress, limit = 12): string {
  const unfinishedDailyPlanIds = [...new Set(progress.dailyPlan.filter(id => Number.isInteger(id) && id > 0))]
    .filter(questionId => getQuestionState(progress, questionId).status !== 'mastered')

  return buildDailyPracticePath(unfinishedDailyPlanIds, limit, 'daily-plan')
}

export function appendPracticeHandoffSource(
  to: string,
  source: string | undefined,
  options: PracticeHandoffSourceOptions = {},
): string {
  if (!source || !to.startsWith('/practice')) {
    return to
  }

  const replace = options.replace ?? true
  const hashIndex = to.indexOf('#')
  const pathAndSearch = hashIndex >= 0 ? to.slice(0, hashIndex) : to
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''
  const encodedSource = encodeURIComponent(source)

  if (/[?&]from=/.test(pathAndSearch)) {
    if (!replace) {
      return to
    }
    return `${pathAndSearch.replace(/([?&])from=[^&]*/, `$1from=${encodedSource}`)}${hash}`
  }

  return `${pathAndSearch}${pathAndSearch.includes('?') ? '&' : '?'}from=${encodedSource}${hash}`
}

export function extractPracticeHandoffSource(queuePath?: string): string | undefined {
  const match = queuePath?.match(/[?&]from=([^&#\s)）]+)/)
  const source = match?.[1]
  if (!source) {
    return undefined
  }

  try {
    return decodeURIComponent(source)
  } catch {
    return source
  }
}

export function preservePracticeHandoffSourceInText(markdown: string, queuePath?: string): string {
  const source = extractPracticeHandoffSource(queuePath)
  if (!source) {
    return markdown
  }

  return markdown.replace(PRACTICE_HANDOFF_PATH_PATTERN, url =>
    PRACTICE_HANDOFF_TARGET_PATTERN.test(url)
      ? appendPracticeHandoffSource(url, source, { replace: false })
      : url,
  )
}
