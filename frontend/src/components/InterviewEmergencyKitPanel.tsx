import { ArrowRightOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { buildInterviewEmergencyKit } from '../utils/interviewEmergencyKit'

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
