import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, message } from 'antd'
import { useMemo } from 'react'
import type {
  PracticeQueueItem,
  PracticeSessionReport,
  PracticeSessionReportAction,
  PracticeSessionRepairAction,
  StudyProgress,
} from '../types'
import { buildPracticeSessionReport, buildPracticeSessionReportMarkdown } from '../utils/practiceSessionReport'

interface PracticeSessionReportPanelProps {
  queue: PracticeQueueItem[]
  progress: StudyProgress
  onNavigate: (to: string) => void
  onUseRepairAction?: (action: PracticeSessionRepairAction) => void
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
  onUseRepairAction,
}: PracticeSessionReportPanelProps) {
  const report = useMemo(
    () => buildPracticeSessionReport(queue, progress),
    [progress, queue],
  )

  const handleCopyReport = async () => {
    const markdown = buildPracticeSessionReportMarkdown(queue, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('本轮模拟面试战报已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 战报')
  }

  const handleRepairAction = (action: PracticeSessionRepairAction) => {
    if (onUseRepairAction) {
      onUseRepairAction(action)
      return
    }
    onNavigate(action.to)
  }

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
        <div className="practice-session-report-head-actions">
          <span>{levelLabels[report.level]}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReport}>
            复制战报
          </Button>
        </div>
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

      {report.repairActions.length > 0 && (
        <div className="practice-session-report-repairs" aria-label="本轮补弱动作">
          <div className="practice-session-report-repairs-head">
            <span>本轮补弱动作</span>
            <small>{report.repairActions.length} 项</small>
          </div>
          {report.repairActions.slice(0, 3).map(action => (
            <article key={`${action.questionId}-${action.criterionLabel}`}>
              <div>
                <strong title={action.title}>{action.title}</strong>
                <span>{action.criterionLabel}</span>
              </div>
              <p>{action.reason}</p>
              <small>{action.action}</small>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRepairAction(action)}>
                去补弱
              </Button>
            </article>
          ))}
        </div>
      )}

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
  link.click()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '面试'}-本轮模拟面试战报.md`
}
