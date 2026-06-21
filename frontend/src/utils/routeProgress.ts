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

/**
 * 构建备考路线战术包 Markdown，便于用户把免费路线和个人化进度复制到外部计划。
 *
 * @param routes 免费备考路线配置
 * @param progress 本地学习进度
 * @param now 生成时间，默认取当前时间
 * @returns 可复制或下载的 Markdown 路线战术包
 */
export function buildRoutePlaybookMarkdown(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const routeProgressList = buildRouteProgressList(routes, progress)

  return [
    `# ${sanitizeMarkdownValue(progress.targetRole, '岗位')} 备考路线战术包`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderRoutePlaybookOverview(routeProgressList),
    renderRoutePlaybookItems(routeProgressList),
  ].join('\n').trimEnd()
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

function renderRoutePlaybookOverview(routeProgressList: RouteProgress[]): string {
  const focus = routeProgressList[0]
  const trackedRoutes = routeProgressList.filter(item => item.totalRemembered > 0).length

  return [
    '## 路线总览',
    `- 核心路线：${routeProgressList.length} 条`,
    `- 今日优先：${focus ? sanitizeMarkdownValue(focus.route.title, '暂无路线') : '暂无路线'}`,
    `- 已建立轨迹：${trackedRoutes} 条`,
    '',
  ].join('\n')
}

function renderRoutePlaybookItems(routeProgressList: RouteProgress[]): string {
  if (routeProgressList.length === 0) {
    return [
      '## 路线战术',
      '- 暂无路线配置，先确认目标岗位后再生成路线包。',
    ].join('\n')
  }

  const lines = ['## 路线战术']
  routeProgressList.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${sanitizeMarkdownValue(item.route.title, `路线 #${index + 1}`)}`,
      `   - 岗位：${sanitizeMarkdownValue(item.route.role, '未设定')}`,
      `   - 周期：${sanitizeMarkdownValue(item.route.duration, '待规划')}`,
      `   - 摘要：${sanitizeMarkdownValue(item.route.summary, '暂无摘要')}`,
      `   - 路线完成度：${item.completionRate}%`,
      `   - 进度：已记忆 ${item.totalRemembered} 道，已跟踪 ${item.tracked} 道，计划内 ${item.planned} 道，薄弱 ${item.weak} 道`,
      `   - 推进阶段：${renderTextList(item.route.stages, '待补充')}`,
      `   - 覆盖方向：${renderTextList(item.route.categories, '待补充')}`,
      `   - 下一组训练：${renderRouteNextStep(item)}`,
      `   - 加入今日计划：${renderRoutePlanIds(item)}`,
      `   - 兜底入口：${firstRouteAction(item.route)}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderRouteNextStep(routeProgress: RouteProgress): string {
  if (routeProgress.nextQuestionIds.length > 0) {
    return `/practice?queue=${routeProgress.nextQuestionIds.slice(0, 12).join(',')}&from=ability-gap`
  }
  if (routeProgress.totalRemembered === 0) {
    return '先搜索并打开几道题建立本地轨迹。'
  }
  return '/practice'
}

function renderRoutePlanIds(routeProgress: RouteProgress): string {
  if (routeProgress.nextQuestionIds.length === 0) {
    return '暂无可加入题目'
  }
  return routeProgress.nextQuestionIds.slice(0, 8).join(',')
}

function firstRouteAction(route: PrepRoute): string {
  return route.actions[0]?.to ?? '/routes'
}

function renderTextList(values: string[], fallback: string): string {
  const normalized = values.map(value => value.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized.join('、') : fallback
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function sanitizeMarkdownValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}
