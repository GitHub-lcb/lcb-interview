import { ArrowRightOutlined, QuestionCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import type { InterviewFollowUpDefense, InterviewFollowUpDefenseItem, StudyProgress } from '../types'
import { buildInterviewFollowUpDefense } from '../utils/interviewFollowUpDefense'

interface InterviewFollowUpDefensePanelProps {
  progress: StudyProgress
  onNavigate: (to: string) => void
}

const levelLabels: Record<InterviewFollowUpDefense['level'], string> = {
  empty: '待建立',
  risk: '高风险',
  pressure: '加压中',
  ready: '较稳定',
}

const criterionClassNames: Record<InterviewFollowUpDefenseItem['criterionKey'], string> = {
  coverage: 'criterion-coverage',
  structure: 'criterion-structure',
  specificity: 'criterion-specificity',
  risk: 'criterion-risk',
  advanced: 'criterion-advanced',
}

export default function InterviewFollowUpDefensePanel({
  progress,
  onNavigate,
}: InterviewFollowUpDefensePanelProps) {
  const defense = useMemo(() => buildInterviewFollowUpDefense(progress), [progress])

  return (
    <section className={`interview-follow-up-defense-panel level-${defense.level}`} aria-label="面试追问防线">
      <div className="interview-follow-up-defense-head">
        <div>
          <div className="dashboard-kicker">
            <QuestionCircleOutlined />
            面试追问防线
          </div>
          <h2>{defense.title}</h2>
          <p>{defense.summary}</p>
        </div>
        <div className="interview-follow-up-defense-action">
          <span>{levelLabels[defense.level]}</span>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => onNavigate(defense.primaryAction.to)}>
            {defense.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
        </div>
      </div>

      <div className="interview-follow-up-defense-metrics">
        {defense.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      {defense.items.length === 0 ? (
        <p className="interview-follow-up-defense-empty">完成一次模拟面试后，这里会自动整理最容易被连续追问的防线清单。</p>
      ) : (
        <div className="interview-follow-up-defense-list">
          {defense.items.map(item => (
            <button
              key={item.id}
              type="button"
              className={criterionClassNames[item.criterionKey]}
              onClick={() => onNavigate(item.to)}
            >
              <div>
                <div className="interview-follow-up-defense-item-top">
                  <strong>{item.title}</strong>
                  <em>{item.criterionLabel} · {item.score} 分</em>
                </div>
                <h3>{item.prompt}</h3>
                <p>{item.pressurePoint}</p>
                <small>{item.answerGuide}</small>
              </div>
              <ArrowRightOutlined />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
