import type { PrepRoute } from '../data/freeSuperiority'
import type {
  DailyPlanBrief,
  DailyPlanCompletion,
  InterviewBriefItem,
  InterviewBriefReport,
  PrepHealthDimension,
  PrepHealthReport,
  StudyProgress,
} from '../types'
import { buildDailyPlanBrief } from './dailyPlanBrief'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewBrief } from './interviewBrief'
import { buildPrepHealthReport } from './prepHealth'

export function buildSprintReportMarkdown(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const health = buildPrepHealthReport(routes, progress, now)
  const brief = buildInterviewBrief(routes, progress, now)
  const completion = buildDailyPlanCompletion(progress, now)
  const dailyBrief = buildDailyPlanBrief(progress, [], now)
  const generatedDate = formatDate(now)

  return [
    `# ${progress.targetRole} 面试冲刺报告`,
    '',
    `生成时间：${generatedDate}`,
    `目标周期：${progress.sprintDays} 天`,
    '',
    renderHealthSection(health),
    renderDimensionsSection(health.dimensions),
    renderDailyCompletionSection(completion),
    renderDailyPlanBriefSection(dailyBrief),
    renderBriefSection('可主动表达', brief.strengths),
    renderBriefSection('必须规避', brief.risks),
    renderBriefSection('开口热身题', brief.warmups),
    renderActionSection(health, brief, completion),
  ].join('\n')
}

function renderHealthSection(health: PrepHealthReport): string {
  return [
    '## 备考健康度',
    `- 总分：${health.score}`,
    `- 状态：${health.title}`,
    `- 最大风险：${health.primaryDimension.label}`,
    `- 说明：${health.summary}`,
    '',
  ].join('\n')
}

function renderDimensionsSection(dimensions: PrepHealthDimension[]): string {
  return [
    '## 四维诊断',
    ...dimensions.map(dimension => (
      `- ${dimension.label}：${dimension.score} 分，${dimension.description}（${dimension.detail}）`
    )),
    '',
  ].join('\n')
}

function renderBriefSection(title: string, items: InterviewBriefItem[]): string {
  if (items.length === 0) {
    return [
      `## ${title}`,
      '- 暂无，继续积累本地学习记录后会自动生成。',
      '',
    ].join('\n')
  }

  return [
    `## ${title}`,
    ...items.map(item => {
      const questionSuffix = item.questionId ? `，题目 ID：${item.questionId}` : ''
      return `- ${item.title}：${item.description}（${item.metric}${questionSuffix}）`
    }),
    '',
  ].join('\n')
}

function renderDailyCompletionSection(completion: DailyPlanCompletion): string {
  const todoLines = completion.todos.length > 0
    ? completion.todos.map(todo => `- 待办：${todo.title} - ${todo.description}（${todo.to}）`)
    : ['- 待办：暂无额外待办。']

  return [
    '## 今日计划闭环',
    `- 状态：${completion.title}`,
    `- 说明：${completion.summary}`,
    `- 完成率：${completion.completionRate}%`,
    `- 已掌握：${completion.masteredCount}/${completion.totalCount}`,
    `- 复习债：${completion.reviewDebtCount} 道`,
    `- 薄弱题：${completion.weakCount} 道`,
    `- 今日面试：${completion.interviewTodayCount} 次`,
    ...todoLines,
    '',
  ].join('\n')
}

function renderDailyPlanBriefSection(brief: DailyPlanBrief): string {
  if (brief.items.length === 0) {
    return [
      '## 今日作战简报',
      `- 摘要：${brief.summary}`,
      '',
    ].join('\n')
  }

  return [
    '## 今日作战简报',
    `- 摘要：${brief.summary}`,
    ...brief.items.slice(0, 8).map(item => (
      `- ${item.title}：${item.sourceLabel}，${item.actionLabel}；${item.reason}（${item.categoryName}，题目 ID：${item.questionId}，${item.to}）`
    )),
    '',
  ].join('\n')
}

function renderActionSection(
  health: PrepHealthReport,
  brief: InterviewBriefReport,
  completion: DailyPlanCompletion,
): string {
  // 报告被复制到外部文档后仍要能指导下一步，所以保留健康、表达和今日闭环三条行动线。
  return [
    '## 下一步行动',
    `- 健康雷达：${health.primaryAction.label} - ${health.primaryAction.description}（${health.primaryAction.to}）`,
    `- 面试简报：${brief.primaryAction.label} - ${brief.primaryAction.description}（${brief.primaryAction.to}）`,
    `- 今日闭环：${completion.primaryAction.label} - ${completion.primaryAction.description}（${completion.primaryAction.to}）`,
    '',
  ].join('\n')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
