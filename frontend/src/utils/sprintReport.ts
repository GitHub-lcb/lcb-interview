import type { PrepRoute } from '../data/freeSuperiority'
import type {
  InterviewBriefItem,
  InterviewBriefReport,
  PrepHealthDimension,
  PrepHealthReport,
  StudyProgress,
} from '../types'
import { buildInterviewBrief } from './interviewBrief'
import { buildPrepHealthReport } from './prepHealth'

export function buildSprintReportMarkdown(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const health = buildPrepHealthReport(routes, progress, now)
  const brief = buildInterviewBrief(routes, progress, now)
  const generatedDate = formatDate(now)

  return [
    `# ${progress.targetRole} 面试冲刺报告`,
    '',
    `生成时间：${generatedDate}`,
    `目标周期：${progress.sprintDays} 天`,
    '',
    renderHealthSection(health),
    renderDimensionsSection(health.dimensions),
    renderBriefSection('可主动表达', brief.strengths),
    renderBriefSection('必须规避', brief.risks),
    renderBriefSection('开口热身题', brief.warmups),
    renderActionSection(health, brief),
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

function renderActionSection(
  health: PrepHealthReport,
  brief: InterviewBriefReport,
): string {
  // 报告里同时保留健康雷达行动和面试简报行动，用户复制出去后也能知道先处理哪条链路。
  return [
    '## 下一步行动',
    `- 健康雷达：${health.primaryAction.label} - ${health.primaryAction.description}（${health.primaryAction.to}）`,
    `- 面试简报：${brief.primaryAction.label} - ${brief.primaryAction.description}（${brief.primaryAction.to}）`,
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
