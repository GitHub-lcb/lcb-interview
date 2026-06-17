import { Button, message, Progress } from 'antd'
import {
  ArrowRightOutlined,
  CopyOutlined,
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
import { buildPrepHealthMarkdown, buildPrepHealthReport } from '../utils/prepHealth'

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

  const handleCopyHealth = async () => {
    const markdown = buildPrepHealthMarkdown(prepRoutes, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('备考健康雷达已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 雷达')
  }

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
          <div className="prep-health-action-buttons">
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(report.primaryAction.to)}>
              {report.primaryAction.label}
            </Button>
            <Button icon={<CopyOutlined />} onClick={handleCopyHealth}>
              复制雷达
            </Button>
          </div>
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
  return `${safeRole || '岗位'}-备考健康雷达.md`
}
