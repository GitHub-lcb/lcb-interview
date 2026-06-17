import { Button, message } from 'antd'
import { ArrowRightOutlined, CopyOutlined, FieldTimeOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyPaceCoachLevel, StudyProgress } from '../types'
import { buildStudyPaceCoach, buildStudyPaceMarkdown } from '../utils/studyPaceCoach'

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

  const handleCopyPace = async () => {
    const markdown = buildStudyPaceMarkdown(progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('备考配速报告已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 配速报告')
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
          <div className="study-pace-action-buttons">
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
            <Button icon={<CopyOutlined />} onClick={handleCopyPace}>
              复制配速
            </Button>
          </div>
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
  return `${safeRole || '岗位'}-备考配速报告.md`
}
