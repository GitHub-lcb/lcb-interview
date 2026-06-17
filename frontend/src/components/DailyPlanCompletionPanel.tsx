import { ArrowRightOutlined, CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { buildDailyPlanCompletion } from '../utils/dailyPlanCompletion'

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
