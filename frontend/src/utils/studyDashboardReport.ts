import type { DailyPlanCompletion, Question, QuestionSnapshot, StudyProgress, WeakArea } from '../types'
import {
  buildDailyPlan,
  getQuestionState,
  resolvePlanQuestions,
  summarizeProgress,
  weakAreasFromQuestions,
} from './studyProgress'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'

/**
 * 构建首页备考工作台日报 Markdown，便于用户把当天执行清单和弱点雷达带到外部打卡或复盘文档。
 *
 * @param progress 当前本地学习进度
 * @param hotQuestions 首页已加载的热门题候选
 * @param now 生成时间，用于测试时固定日期
 * @returns 可复制或下载的 Markdown 工作台日报
 */
export function buildStudyDashboardMarkdown(
  progress: StudyProgress,
  hotQuestions: Question[],
  now = new Date().toISOString(),
): string {
  const summary = summarizeProgress(progress)
  const planLimit = Math.max(progress.dailyPlan.length, 5)
  const generatedPlanIds = buildDailyPlan(progress, hotQuestions, planLimit)
  const planQuestions = resolvePlanQuestions(progress, hotQuestions, 5)
  const nextQuestion = planQuestions[0] ?? hotQuestions[0]
  const weakAreas = weakAreasFromQuestions(progress, hotQuestions)
  const completion = buildDailyPlanCompletion(progress, now)

  return [
    `# ${progress.targetRole} 备考工作台日报`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderOverview(progress, summary),
    renderDailyCompletion(completion),
    renderNextQuestion(nextQuestion),
    renderPlanQuestions(progress, planQuestions, generatedPlanIds),
    renderWeakAreas(weakAreas),
  ].join('\n').trimEnd()
}

function renderOverview(
  progress: StudyProgress,
  summary: ReturnType<typeof summarizeProgress>,
): string {
  return [
    '## 工作台概览',
    `- 冲刺周期：${progress.sprintDays} 天`,
    `- 今日计划：${progress.dailyPlan.length} 道`,
    `- 薄弱题：${summary.weak} 道`,
    `- 跟踪题：${summary.totalTracked} 道`,
    `- 掌握率：${summary.masteryRate}%`,
    '',
  ].join('\n')
}

function renderNextQuestion(question?: QuestionSnapshot | Question): string {
  if (!question) {
    return [
      '## 下一题',
      '- 先生成今日计划，再进入训练页开始第一轮模拟面试。',
      '',
    ].join('\n')
  }

  return [
    '## 下一题',
    `- ${question.title}`,
    `- 分类：${question.categoryName || '未分类'}`,
    `- 难度：${question.difficulty || '未知'}`,
    `- 路径：/question/${question.id}`,
    '',
  ].join('\n')
}

function renderPlanQuestions(
  progress: StudyProgress,
  questions: QuestionSnapshot[],
  generatedPlanIds: number[],
): string {
  if (questions.length === 0) {
    return [
      '## 今日计划题单',
      '- 先生成今日计划，把推荐题变成今天可执行的训练清单。',
      '',
    ].join('\n')
  }

  const generatedSet = new Set(generatedPlanIds)
  return [
    '## 今日计划题单',
    ...questions.map((question, index) => {
      const state = getQuestionState(progress, question.id)
      const planned = state.addedToPlan || progress.dailyPlan.includes(question.id)
      return [
        `${index + 1}. ${question.title}`,
        `   - 分类：${question.categoryName || '未分类'}`,
        `   - 难度：${question.difficulty || '未知'}`,
        `   - 状态：${planned ? '计划内' : generatedSet.has(question.id) ? '推荐' : '候选'}`,
        `   - 路径：/question/${question.id}`,
      ].join('\n')
    }),
    '',
  ].join('\n')
}

function renderWeakAreas(weakAreas: WeakArea[]): string {
  if (weakAreas.length === 0) {
    return [
      '## 弱点雷达',
      '- 暂无弱点雷达。先标记薄弱题或完成模拟面试，系统会按分类聚合风险。',
    ].join('\n')
  }

  return [
    '## 弱点雷达',
    ...weakAreas.map((area, index) => [
      `${index + 1}. ${area.categoryName}：${area.score}`,
      `   - 薄弱 ${area.weakCount} 道，学习中 ${area.learningCount} 道，已掌握 ${area.masteredCount} 道`,
    ].join('\n')),
  ].join('\n')
}

function renderDailyCompletion(completion: DailyPlanCompletion): string {
  const impactLines = completion.statusImpacts.length > 0
    ? completion.statusImpacts.map(impact => (
      `- 评分影响：${impact.title}，${impact.score} 分，${impact.message}；行动：${impact.actionLabel}，入口：${impact.to}`
    ))
    : ['- 评分影响：今日还没有计划内模拟面试评分，完成评分后会自动解释计划变化。']

  return [
    '## 今日闭环验收',
    `- 状态：${completion.title}`,
    `- 说明：${completion.summary}`,
    `- 完成率：${completion.completionRate}%`,
    `- 主行动：${completion.primaryAction.label}，${completion.primaryAction.to}`,
    ...impactLines,
    '',
  ].join('\n')
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}
