import { ArrowRightOutlined, CheckCircleOutlined, CopyOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { buildDailyPlanCompletion, buildDailyPlanCompletionMarkdown } from '../utils/dailyPlanCompletion'

interface DailyPlanCompletionPanelProps {
  progress: StudyProgress
  now?: string
}

export default function DailyPlanCompletionPanel({
  progress,
  now,
}: DailyPlanCompletionPanelProps) {
  const navigate = useNavigate()
  const completion = useMemo(
    () => buildDailyPlanCompletion(progress, now),
    [now, progress],
  )

  const handleCopyCompletion = async () => {
    const markdown = buildDailyPlanCompletionMarkdown(progress, now)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('今日闭环验收已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 验收')
  }

  return (
    <section className={`daily-plan-completion-panel level-${completion.level}`} aria-label="今日闭环验收">
      <div className="daily-plan-completion-head">
        <div>
          <div className="dashboard-kicker">
            <SafetyCertificateOutlined />
            今日闭环验收
          </div>
          <h2>{completion.title}</h2>
          <p>{completion.summary}</p>
        </div>
        <div className="daily-plan-completion-score">
          <strong>{completion.completionRate}%</strong>
          <span>完成率</span>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyCompletion}>
            复制验收
          </Button>
        </div>
      </div>

      <div className="daily-plan-completion-body">
        <div className="daily-plan-completion-metrics">
          {completion.metrics.map(metric => (
            <article key={metric.key}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="daily-plan-completion-action">
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => navigate(completion.primaryAction.to)}>
            {completion.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
          <span>{completion.primaryAction.description}</span>
        </div>
      </div>

      <div className="daily-plan-completion-todos">
        {completion.todos.map(todo => (
          <button key={todo.id} type="button" className={`tone-${todo.tone}`} onClick={() => navigate(todo.to)}>
            <div>
              <strong>{todo.title}</strong>
              <span>{todo.description}</span>
            </div>
            <ArrowRightOutlined />
          </button>
        ))}
      </div>
    </section>
  )
}

async function copyMarkdown(markdown: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(markdown)
    return true
  } catch {
    return false
  }
}

function downloadMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-今日闭环验收.md`
}
