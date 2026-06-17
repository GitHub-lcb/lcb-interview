import { Button, message } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  CopyOutlined,
  FireOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../data/freeSuperiority'
import type { InterviewBriefItem, StudyProgress } from '../types'
import { buildInterviewBrief, buildInterviewBriefMarkdown } from '../utils/interviewBrief'

interface InterviewBriefPanelProps {
  progress: StudyProgress
}

function renderBriefItems(
  items: InterviewBriefItem[],
  emptyText: string,
  onNavigate: (to: string) => void,
) {
  if (items.length === 0) {
    return <p className="interview-brief-empty">{emptyText}</p>
  }

  return (
    <div className="interview-brief-list">
      {items.map(item => (
        <button key={item.id} type="button" onClick={() => item.to && onNavigate(item.to)}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </div>
          <em>{item.metric}</em>
        </button>
      ))}
    </div>
  )
}

export default function InterviewBriefPanel({ progress }: InterviewBriefPanelProps) {
  const navigate = useNavigate()
  const brief = useMemo(() => buildInterviewBrief(prepRoutes, progress), [progress])

  const handleCopyBrief = async () => {
    const markdown = buildInterviewBriefMarkdown(prepRoutes, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('冲刺简报已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 简报')
  }

  return (
    <section className={`interview-brief-panel level-${brief.level}`} aria-label="面试前冲刺简报">
      <div className="interview-brief-head">
        <div>
          <div className="dashboard-kicker">面试前冲刺简报</div>
          <h2>{brief.title}</h2>
          <p>{brief.summary}</p>
        </div>
        <div className="interview-brief-head-actions">
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyBrief}>
            复制简报
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(brief.primaryAction.to)}>
            {brief.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
        </div>
      </div>

      <div className="interview-brief-action-note">
        <ThunderboltOutlined />
        <span>{brief.primaryAction.description}</span>
      </div>

      <div className="interview-brief-grid">
        <article className="interview-brief-card strength">
          <div className="interview-brief-card-title">
            <BookOutlined />
            <span>可主动表达</span>
          </div>
          {renderBriefItems(brief.strengths, '掌握题会自动沉淀为面试优势。', navigate)}
        </article>

        <article className="interview-brief-card risk">
          <div className="interview-brief-card-title">
            <FireOutlined />
            <span>必须规避</span>
          </div>
          {renderBriefItems(brief.risks, '当前没有显著风险，保持节奏即可。', navigate)}
        </article>

        <article className="interview-brief-card warmup">
          <div className="interview-brief-card-title">
            <PlayCircleOutlined />
            <span>开口热身</span>
          </div>
          {renderBriefItems(brief.warmups, '加入计划或复习队列后会生成热身题。', navigate)}
        </article>
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
  link.click()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-面试前冲刺简报.md`
}
