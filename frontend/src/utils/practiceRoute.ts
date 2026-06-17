export function buildDailyPracticePath(questionIds: number[], limit = 12): string {
  const queue = [...new Set(questionIds)]
    .filter(questionId => Number.isFinite(questionId) && questionId > 0)
    .slice(0, Math.max(0, limit))

  if (queue.length === 0) {
    return '/practice'
  }

  return `/practice?queue=${queue.join(',')}`
}
