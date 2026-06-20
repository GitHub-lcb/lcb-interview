import { Button } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CopyOutlined,
  FireOutlined,
  RadarChartOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../data/freeSuperiority'
import { useStudyProgress } from '../hooks/useStudyProgress'
import type { DailyMissionKind } from '../types'
import { buildDailyMissionMarkdown, buildDailyMissionPlan } from '../utils/dailyMission'

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

  const handleCopyMissions = async () => {
    const markdown = buildDailyMissionMarkdown(prepRoutes, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('今日冲刺任务已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 任务')
  }

  return (
    <section className="daily-mission-panel" aria-label="今日冲刺任务">
      <div className="daily-mission-heading">
        <div>
          <div className="dashboard-kicker">今日冲刺任务</div>
          <h2>{plan.title}</h2>
          <p>{plan.summary}</p>
        </div>
        <div className="daily-mission-heading-actions">
          <strong>{plan.missions.length}</strong>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyMissions}>
            复制任务
          </Button>
        </div>
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
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-今日冲刺任务.md`
}
