import type { PrepRoute } from '../data/freeSuperiority'
import type { QuestionSnapshot, StudyProgress } from '../types'
import { getQuestionState } from './studyProgress'

export interface RouteProgress {
  route: PrepRoute
  questionIds: number[]
  nextQuestionIds: number[]
  totalRemembered: number
  tracked: number
  planned: number
  weak: number
  mastered: number
  completionRate: number
}

export function buildRouteProgress(route: PrepRoute, progress: StudyProgress): RouteProgress {
  const routeCategories = new Set(route.categories)
  const snapshots = Object.values(progress.questionSnapshots)
  const matchedQuestions = snapshots.filter(snapshot => matchesRoute(snapshot, routeCategories))
  const questionIds = matchedQuestions.map(question => question.id)
  const states = questionIds.map(questionId => getQuestionState(progress, questionId))
  const totalRemembered = questionIds.length
  const tracked = states.filter(state => state.status !== 'new' || state.addedToPlan).length
  const planned = states.filter(state => state.addedToPlan).length
  const weak = states.filter(state => state.status === 'weak').length
  const mastered = states.filter(state => state.status === 'mastered').length

  return {
    route,
    questionIds,
    // 只把非掌握题加入下一步，避免用户一键计划时重复安排已经稳定掌握的题。
    nextQuestionIds: questionIds.filter(questionId => getQuestionState(progress, questionId).status !== 'mastered'),
    totalRemembered,
    tracked,
    planned,
    weak,
    mastered,
    completionRate: totalRemembered === 0 ? 0 : Math.round((mastered / totalRemembered) * 100),
  }
}

export function buildRouteProgressList(routes: PrepRoute[], progress: StudyProgress): RouteProgress[] {
  return routes
    .map(route => buildRouteProgress(route, progress))
    .sort((a, b) => routeSortScore(b) - routeSortScore(a))
}

function matchesRoute(snapshot: QuestionSnapshot, routeCategories: Set<string>): boolean {
  // 路线页不主动请求全量题目，避免一次打开页面触发多分类查询；只使用用户已经浏览过的快照做个人化判断。
  if (routeCategories.has(snapshot.categoryName)) {
    return true
  }
  return snapshot.tags.some(tag => routeCategories.has(tag))
}

function routeSortScore(progress: RouteProgress): number {
  const unplanned = Math.max(0, progress.totalRemembered - progress.planned)
  const incomplete = Math.max(0, 100 - progress.completionRate)
  // 排序优先级：薄弱题最影响面试表现，其次是已经看过但还没进入计划的题，最后才是整体完成度。
  return progress.weak * 100 + unplanned * 10 + incomplete / 10
}
