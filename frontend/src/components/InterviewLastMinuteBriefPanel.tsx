import { ArrowRightOutlined, FlagOutlined, ProfileOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { buildInterviewLastMinuteBrief } from '../utils/interviewLastMinuteBrief'

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
