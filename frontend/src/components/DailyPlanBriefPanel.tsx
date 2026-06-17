import { ArrowRightOutlined, CopyOutlined, FieldTimeOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question, StudyProgress } from '../types'
import { buildDailyPlanBrief, buildDailyPlanBriefMarkdown } from '../utils/dailyPlanBrief'

interface DailyPlanBriefPanelProps {
  progress: StudyProgress
  candidates: Question[]
  now?: string
}

export default function DailyPlanBriefPanel({
  progress,
  candidates,
  now,
}: DailyPlanBriefPanelProps) {
  const navigate = useNavigate()
  const brief = useMemo(
    () => buildDailyPlanBrief(progress, candidates, now),
    [candidates, now, progress],
  )
  const visibleItems = brief.items.slice(0, 6)

  const handleCopyBrief = async () => {
    const markdown = buildDailyPlanBriefMarkdown(progress, candidates, now)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('今日作战简报已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 简报')
  }

  return (
    <section className="daily-plan-brief-panel" aria-label="今日作战简报">
      <div className="daily-plan-brief-head">
        <div>
          <div className="dashboard-kicker">
            <FieldTimeOutlined />
            今日作战简报
          </div>
          <h2>{brief.title}</h2>
          <p>{brief.summary}</p>
        </div>
        <div className="daily-plan-brief-head-actions">
          <span>{brief.totalCount > 0 ? `展示 ${visibleItems.length}/${brief.totalCount}` : '待生成'}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyBrief}>
            复制简报
          </Button>
        </div>
      </div>

      <div className="daily-plan-brief-metrics">
        {brief.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <div className="daily-plan-brief-empty">
          <ThunderboltOutlined />
          <p>生成今日计划后，这里会解释每道题的训练原因。</p>
        </div>
      ) : (
        <div className="daily-plan-brief-list">
          {visibleItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`source-${item.source}`}
              onClick={() => navigate(item.to)}
            >
              <div>
                <span>{item.sourceLabel}</span>
                <strong>{item.title}</strong>
                <small>{item.categoryName} · {item.reason}</small>
              </div>
              <em>{item.actionLabel}</em>
              <ArrowRightOutlined />
            </button>
          ))}
        </div>
      )}
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
  return `${safeRole || '岗位'}-今日作战简报.md`
}
