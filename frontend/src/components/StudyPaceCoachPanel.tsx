import { Button } from 'antd'
import { ArrowRightOutlined, FieldTimeOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyPaceCoachLevel, StudyProgress } from '../types'
import { buildStudyPaceCoach } from '../utils/studyPaceCoach'

interface StudyPaceCoachPanelProps {
  progress: StudyProgress
  canFillPlan?: boolean
  isFillingPlan?: boolean
  onFillPlan?: () => void
}

const levelLabels: Record<StudyPaceCoachLevel, string> = {
  empty: '待启动',
  behind: '需补齐',
  balanced: '稳定',
  ahead: '超前',
}

export default function StudyPaceCoachPanel({
  progress,
  canFillPlan,
  isFillingPlan,
  onFillPlan,
}: StudyPaceCoachPanelProps) {
  const navigate = useNavigate()
  const coach = useMemo(() => buildStudyPaceCoach(progress), [progress])
  const shouldFillPlan = coach.primaryAction.key === 'plan' && Boolean(onFillPlan)

  const handlePrimaryAction = () => {
    if (shouldFillPlan) {
      onFillPlan?.()
      return
    }
    navigate(coach.primaryAction.to)
  }

  return (
    <section className={`study-pace-panel level-${coach.level}`} aria-label="备考配速教练">
      <div className="study-pace-main">
        <div>
          <div className="dashboard-kicker">
            <FieldTimeOutlined />
            备考配速教练
          </div>
          <h2>{coach.title}</h2>
          <p>{coach.summary}</p>
        </div>
        <div className="study-pace-action">
          <span>{levelLabels[coach.level]}</span>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            disabled={shouldFillPlan && canFillPlan === false}
            loading={shouldFillPlan && isFillingPlan}
            onClick={handlePrimaryAction}
          >
            {coach.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
        </div>
      </div>

      <div className="study-pace-metrics">
        {coach.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
