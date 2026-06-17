import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import type {
  PracticeQueueItem,
  PracticeSessionReport,
  PracticeSessionReportAction,
  StudyProgress,
} from '../types'
import { buildPracticeSessionReport } from '../utils/practiceSessionReport'

interface PracticeSessionReportPanelProps {
  queue: PracticeQueueItem[]
  progress: StudyProgress
  onNavigate: (to: string) => void
}

const levelLabels: Record<PracticeSessionReport['level'], string> = {
  empty: '待开始',
  'in-progress': '推进中',
  risk: '需补弱',
  passed: '已通过',
}

const actionIcons: Record<PracticeSessionReportAction['kind'], JSX.Element> = {
  start: <PlayCircleOutlined />,
  repair: <ReloadOutlined />,
  continue: <ArrowRightOutlined />,
  review: <CheckCircleOutlined />,
}

export default function PracticeSessionReportPanel({
  queue,
  progress,
  onNavigate,
}: PracticeSessionReportPanelProps) {
  const report = useMemo(
    () => buildPracticeSessionReport(queue, progress),
    [progress, queue],
  )

  return (
    <section className={`practice-session-report-panel level-${report.level}`} aria-label="本轮模拟面试战报">
      <div className="practice-session-report-head">
        <div>
          <div className="dashboard-kicker">
            <BarChartOutlined />
            本轮模拟面试战报
          </div>
          <h3>{report.title}</h3>
          <p>{report.summary}</p>
        </div>
        <span>{levelLabels[report.level]}</span>
      </div>

      <div className="practice-session-report-metrics">
        {report.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <Button
        className="practice-session-report-action"
        type="primary"
        danger={report.level === 'risk'}
        icon={actionIcons[report.primaryAction.kind]}
        onClick={() => onNavigate(report.primaryAction.to)}
      >
        {report.primaryAction.label}
        <ArrowRightOutlined />
      </Button>
    </section>
  )
}
