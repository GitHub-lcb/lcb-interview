import { Button, message } from 'antd'
import { ArrowRightOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { InterviewFeedback, PracticeQueueItem } from '../types'
import { buildFollowUpDrillMarkdown, buildFollowUpDrillPack } from '../utils/followUpDrill'

interface FollowUpDrillPanelProps {
  question: PracticeQueueItem
  answer: string
  feedback: InterviewFeedback
  onPickPrompt: (prompt: string) => void
}

export default function FollowUpDrillPanel({
  question,
  answer,
  feedback,
  onPickPrompt,
}: FollowUpDrillPanelProps) {
  const pack = useMemo(
    () => buildFollowUpDrillPack(question, answer, feedback),
    [answer, feedback, question],
  )

  const handleCopyDrill = async () => {
    const markdown = buildFollowUpDrillMarkdown(question, answer, feedback)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('追问训练包已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    message.warning('剪贴板不可用，已下载 Markdown 追问训练包')
  }

  return (
    <section className="follow-up-drill-panel" aria-label="追问加压训练">
      <div className="follow-up-drill-head">
        <div>
          <div className="dashboard-kicker">追问加压训练</div>
          <h2>{pack.title}</h2>
          <p>{pack.summary}</p>
        </div>
        <div className="follow-up-drill-head-actions">
          <ThunderboltOutlined />
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyDrill}>
            复制追问
          </Button>
        </div>
      </div>

      <div className="follow-up-drill-grid">
        {pack.items.map(item => (
          <article key={item.id} className={`follow-up-drill-card criterion-${item.criterionKey}`}>
            <div className="follow-up-drill-card-top">
              <span>{item.criterionLabel}</span>
              <em>{item.priority}</em>
            </div>
            <h3>{item.prompt}</h3>
            <p>{item.pressurePoint}</p>
            <small>{item.answerGuide}</small>
            <Button icon={<ArrowRightOutlined />} onClick={() => onPickPrompt(item.prompt)}>
              带入回答框
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

function buildFileName(title: string): string {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeTitle || '题目'}-追问加压训练.md`
}
