import { Button } from 'antd'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  FireOutlined,
  RadarChartOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../data/freeSuperiority'
import { useStudyProgress } from '../hooks/useStudyProgress'
import type { DailyMissionKind } from '../types'
import { buildDailyMissionPlan } from '../utils/dailyMission'

const missionIcons: Record<DailyMissionKind, JSX.Element> = {
  review: <FireOutlined />,
  ability: <RadarChartOutlined />,
  interview: <SoundOutlined />,
  plan: <CalendarOutlined />,
}

export default function DailyMissionPanel() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const plan = useMemo(() => buildDailyMissionPlan(prepRoutes, progress), [progress])

  return (
    <section className="daily-mission-panel" aria-label="今日冲刺任务">
      <div className="daily-mission-heading">
        <div>
          <div className="dashboard-kicker">今日冲刺任务</div>
          <h2>{plan.title}</h2>
          <p>{plan.summary}</p>
        </div>
        <strong>{plan.missions.length}</strong>
      </div>

      <div className="daily-mission-grid">
        {plan.missions.map((mission, index) => (
          <article key={mission.id} className={`daily-mission-card kind-${mission.kind}`}>
            <div className="daily-mission-card-top">
              <span className="daily-mission-rank">{index + 1}</span>
              <span className="daily-mission-kind">{missionIcons[mission.kind]}</span>
              <em>{mission.metric}</em>
            </div>
            <h3>{mission.title}</h3>
            <p>{mission.description}</p>
            <small>{mission.reason}</small>
            <Button type={index === 0 ? 'primary' : 'default'} icon={<ArrowRightOutlined />} onClick={() => navigate(mission.to)}>
              开始执行
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
