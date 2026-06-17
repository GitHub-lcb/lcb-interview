import { Button, Progress } from 'antd'
import {
  ArrowRightOutlined,
  FieldTimeOutlined,
  FireOutlined,
  RadarChartOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../data/freeSuperiority'
import { useStudyProgress } from '../hooks/useStudyProgress'
import type { PrepHealthDimensionKey, PrepHealthLevel } from '../types'
import { buildPrepHealthReport } from '../utils/prepHealth'

const dimensionIcons: Record<PrepHealthDimensionKey, JSX.Element> = {
  review: <FireOutlined />,
  ability: <RadarChartOutlined />,
  interview: <SoundOutlined />,
  pace: <FieldTimeOutlined />,
}

const levelLabels: Record<PrepHealthLevel, string> = {
  empty: '待建立',
  risk: '高风险',
  watch: '需校准',
  healthy: '健康',
}

function strokeColor(level: PrepHealthLevel) {
  if (level === 'healthy') {
    return '#059669'
  }
  if (level === 'watch') {
    return '#2563EB'
  }
  if (level === 'risk') {
    return '#DC2626'
  }
  return '#D97706'
}

export default function PrepHealthRadarPanel() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const report = useMemo(() => buildPrepHealthReport(prepRoutes, progress), [progress])

  return (
    <section className={`prep-health-panel level-${report.level}`} aria-label="备考健康雷达">
      <div className="prep-health-main">
        <div className="prep-health-kicker">
          <RadarChartOutlined />
          备考健康雷达
        </div>
        <div className="prep-health-score-row">
          <strong>{report.score}</strong>
          <div>
            <span>{levelLabels[report.level]}</span>
            <Progress percent={report.score} showInfo={false} strokeColor={strokeColor(report.level)} />
          </div>
        </div>
        <h2>{report.title}</h2>
        <p>{report.summary}</p>
        <div className="prep-health-action">
          <span>{report.primaryAction.description}</span>
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(report.primaryAction.to)}>
            {report.primaryAction.label}
          </Button>
        </div>
      </div>

      <div className="prep-health-grid">
        {report.dimensions.map(dimension => (
          <article key={dimension.key} className={`prep-health-dimension status-${dimension.status}`}>
            <div className="prep-health-dimension-top">
              <span>{dimensionIcons[dimension.key]}</span>
              <em>{dimension.metric}</em>
            </div>
            <div className="prep-health-dimension-score">
              <strong>{dimension.score}</strong>
              <small>{dimension.label}</small>
            </div>
            <p>{dimension.description}</p>
            <small>{dimension.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
