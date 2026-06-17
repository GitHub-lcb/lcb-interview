import type { PrepRoute } from '../data/freeSuperiority'
import type {
  AbilityMapItem,
  AbilityReadinessLevel,
  QuestionSnapshot,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'
import { getQuestionState } from './studyProgress'

const NEXT_QUESTION_LIMIT = 12

export function buildAbilityMap(routes: PrepRoute[], progress: StudyProgress): AbilityMapItem[] {
  return routes
    .map(route => buildAbilityMapItem(route, progress))
    .sort((a, b) => abilitySortScore(b) - abilitySortScore(a))
}

function buildAbilityMapItem(route: PrepRoute, progress: StudyProgress): AbilityMapItem {
  const routeCategories = new Set(route.categories)
  // 首页不能为了能力地图拉全量题库，只基于用户已经浏览过的本地快照生成画像。
  const matchedQuestions = Object.values(progress.questionSnapshots)
    .filter(snapshot => matchesRoute(snapshot, routeCategories))
  const states = matchedQuestions.map(question => getQuestionState(progress, question.id))
  const readinessScore = calculateReadinessScore(states.map(state => state.status))
  const readinessLevel = resolveReadinessLevel(matchedQuestions.length, readinessScore)

  return {
    routeId: route.id,
    title: route.title,
    role: route.role,
    readinessScore,
    readinessLevel,
    remembered: matchedQuestions.length,
    mastered: states.filter(state => state.status === 'mastered').length,
    weak: states.filter(state => state.status === 'weak').length,
    learning: states.filter(state => state.status === 'learning').length,
    nextQuestionIds: buildNextQuestionIds(matchedQuestions, progress),
    summary: buildSummary(readinessLevel),
  }
}

function matchesRoute(snapshot: QuestionSnapshot, routeCategories: Set<string>): boolean {
  if (routeCategories.has(snapshot.categoryName)) {
    return true
  }
  return snapshot.tags.some(tag => routeCategories.has(tag))
}

function calculateReadinessScore(statuses: StudyQuestionStatus[]): number {
  if (statuses.length === 0) {
    return 0
  }
  const total = statuses.reduce((sum, status) => sum + scoreForStatus(status), 0)
  return Math.round(total / statuses.length)
}

function scoreForStatus(status: StudyQuestionStatus): number {
  if (status === 'mastered') {
    return 100
  }
  if (status === 'learning') {
    return 60
  }
  if (status === 'weak') {
    return 25
  }
  return 10
}

function resolveReadinessLevel(remembered: number, score: number): AbilityReadinessLevel {
  if (remembered === 0) {
    return 'empty'
  }
  if (score < 45) {
    return 'weak'
  }
  if (score < 75) {
    return 'building'
  }
  return 'ready'
}

function buildNextQuestionIds(questions: QuestionSnapshot[], progress: StudyProgress): number[] {
  return [...questions]
    .sort((a, b) => statusRank(getQuestionState(progress, a.id).status) - statusRank(getQuestionState(progress, b.id).status))
    // 掌握题不进入下一步训练队列，避免能力地图把用户带回已经稳定的内容。
    .filter(question => getQuestionState(progress, question.id).status !== 'mastered')
    .map(question => question.id)
    .slice(0, NEXT_QUESTION_LIMIT)
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

function buildSummary(level: AbilityReadinessLevel): string {
  if (level === 'empty') {
    return '还没有本地题目轨迹，先打开路线题目建立能力画像。'
  }
  if (level === 'weak') {
    return '短板明显，优先进入路线训练，把薄弱题拉回学习中。'
  }
  if (level === 'building') {
    return '能力正在成型，继续复习未掌握题并补齐表达。'
  }
  return '准备度较高，适合进入模拟面试和项目追问。'
}

function abilitySortScore(item: AbilityMapItem): number {
  if (item.readinessLevel === 'empty') {
    return 10
  }
  return item.weak * 1000 + item.learning * 120 + (100 - item.readinessScore)
}
