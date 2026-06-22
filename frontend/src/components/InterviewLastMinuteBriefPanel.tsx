import { ArrowRightOutlined, CopyOutlined, FlagOutlined, ProfileOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { buildInterviewLastMinuteBrief, buildInterviewLastMinuteBriefMarkdown } from '../utils/interviewLastMinuteBrief'

interface InterviewLastMinuteBriefPanelProps {
  progress: StudyProgress
  now?: string
}

export default function InterviewLastMinuteBriefPanel({
  progress,
  now,
}: InterviewLastMinuteBriefPanelProps) {
  const navigate = useNavigate()
  const brief = useMemo(
    () => buildInterviewLastMinuteBrief(progress, now),
    [now, progress],
  )

  const handleCopyBrief = async () => {
    const markdown = buildInterviewLastMinuteBriefMarkdown(progress, now)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('面试简报已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 简报')
  }

  return (
    <section className={`interview-last-minute-brief-panel level-${brief.level}`} aria-label="最后 24 小时面试简报">
      <div className="interview-last-minute-brief-head">
        <div>
          <div className="dashboard-kicker">
            <ProfileOutlined />
            最后 24 小时面试简报
          </div>
          <h2>{brief.title}</h2>
          <p>{brief.summary}</p>
        </div>
        <div className="interview-last-minute-brief-score">
          <strong>{brief.confidenceScore}</strong>
          <span>进场信心</span>
        </div>
      </div>

      <div className="interview-last-minute-brief-body">
        <div className="interview-last-minute-brief-metrics">
          {brief.metrics.map(metric => (
            <article key={metric.key}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="interview-last-minute-brief-action">
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyBrief}>
            复制简报
          </Button>
          <Button type="primary" icon={<FlagOutlined />} onClick={() => navigate(brief.primaryAction.to)}>
            {brief.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
          <span>{brief.primaryAction.description}</span>
        </div>
      </div>

      <div className="interview-last-minute-brief-list">
        {brief.items.map(item => (
          <button key={item.id} type="button" className={`kind-${item.kind}`} onClick={() => navigate(item.to)}>
            <div>
              <div className="interview-last-minute-brief-item-top">
                <strong>{item.title}</strong>
                <em>{item.actionLabel}</em>
              </div>
              <p>{item.detail}</p>
              <small>{item.evidence}</small>
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
  link.click()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-最后24小时面试简报.md`
}
