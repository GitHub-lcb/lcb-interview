import { Button, Progress } from 'antd'
import {
  ArrowRightOutlined,
  CompassOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildStudyStrategy } from '../utils/studyStrategy'
import type { StudyStrategyAction } from '../types'

function buttonType(action: StudyStrategyAction) {
  return action.tone === 'primary' ? 'primary' : 'default'
}

export default function StudyCommandCenter() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const strategy = useMemo(() => buildStudyStrategy(progress), [progress])

  return (
    <section className={`study-command-center level-${strategy.level}`} aria-label="备考指挥中心">
      <div className="command-score-card">
        <div className="command-card-kicker">
          <CompassOutlined />
          备考就绪度
        </div>
        <strong>{strategy.readinessScore}</strong>
        <Progress percent={strategy.readinessScore} showInfo={false} strokeColor="#059669" />
        <span>{strategy.title}</span>
      </div>

      <div className="command-main-card">
        <div className="command-main-header">
          <div>
            <div className="dashboard-kicker">智能备考指挥中心</div>
            <h2>{strategy.primaryRisk.title}</h2>
            <p>{strategy.summary}</p>
          </div>
          <div className="command-risk-badge">
            <ExclamationCircleOutlined />
            最大短板
          </div>
        </div>

        <div className="command-factor-grid">
          {strategy.factors.map(factor => (
            <div key={factor.key}>
              <span>{factor.label}</span>
              <strong>{factor.value}</strong>
              <small>{factor.detail}</small>
            </div>
          ))}
        </div>

        <div className="command-action-row">
          {strategy.actions.map(action => (
            <Button
              key={action.key}
              type={buttonType(action)}
              danger={action.tone === 'warning'}
              icon={<FieldTimeOutlined />}
              onClick={() => navigate(action.to)}
            >
              {action.label}
              <ArrowRightOutlined />
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
