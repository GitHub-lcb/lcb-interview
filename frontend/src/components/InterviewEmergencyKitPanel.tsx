import { ArrowRightOutlined, ClockCircleOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { buildInterviewEmergencyKit, buildInterviewEmergencyKitMarkdown } from '../utils/interviewEmergencyKit'

interface InterviewEmergencyKitPanelProps {
  progress: StudyProgress
  now?: string
}

export default function InterviewEmergencyKitPanel({
  progress,
  now,
}: InterviewEmergencyKitPanelProps) {
  const navigate = useNavigate()
  const kit = useMemo(
    () => buildInterviewEmergencyKit(progress, now),
    [now, progress],
  )

  const handleCopyKit = async () => {
    const markdown = buildInterviewEmergencyKitMarkdown(progress, now)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('面试急救包已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 急救包')
  }

  return (
    <section className={`interview-emergency-kit-panel level-${kit.level}`} aria-label="面试前急救包">
      <div className="interview-emergency-kit-head">
        <div>
          <div className="dashboard-kicker">
            <ThunderboltOutlined />
            面试前急救包
          </div>
          <h2>{kit.title}</h2>
          <p>{kit.summary}</p>
        </div>
        <div className="interview-emergency-kit-total">
          <strong>{kit.totalMinutes}</strong>
          <span>分钟</span>
        </div>
      </div>

      <div className="interview-emergency-kit-body">
        <div className="interview-emergency-kit-metrics">
          {kit.metrics.map(metric => (
            <article key={metric.key}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="interview-emergency-kit-action">
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyKit}>
            复制急救包
          </Button>
          <Button type="primary" icon={<ClockCircleOutlined />} onClick={() => navigate(kit.primaryAction.to)}>
            {kit.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
          <span>{kit.primaryAction.description}</span>
        </div>
      </div>

      <div className="interview-emergency-kit-list">
        {kit.items.map(item => (
          <button key={item.id} type="button" className={`kind-${item.kind}`} onClick={() => navigate(item.to)}>
            <div>
              <div className="interview-emergency-kit-item-top">
                <strong>{item.title}</strong>
                <em>{item.durationMinutes} 分钟</em>
              </div>
              <p>{item.description}</p>
              <small>{item.reason}</small>
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
  return `${safeRole || '岗位'}-面试前急救包.md`
}
