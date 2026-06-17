import { Button, message } from 'antd'
import { CopyOutlined, EditOutlined, FormOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { PracticeQueueItem } from '../types'
import {
  buildPracticeAnswerScaffold,
  buildPracticeAnswerScaffoldMarkdown,
} from '../utils/practiceAnswerScaffold'

interface PracticeAnswerScaffoldPanelProps {
  question: PracticeQueueItem
  targetRole: string
  onUseTemplate: (template: string) => void
}

export default function PracticeAnswerScaffoldPanel({
  question,
  targetRole,
  onUseTemplate,
}: PracticeAnswerScaffoldPanelProps) {
  const scaffold = useMemo(
    () => buildPracticeAnswerScaffold(question, targetRole),
    [question, targetRole],
  )

  const handleCopyScaffold = async () => {
    const markdown = buildPracticeAnswerScaffoldMarkdown(question, targetRole)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('答题脚手架已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    message.warning('剪贴板不可用，已下载 Markdown 脚手架')
  }

  return (
    <section className="practice-answer-scaffold-panel" aria-label="答题脚手架">
      <div className="practice-answer-scaffold-head">
        <div className="practice-answer-scaffold-title">
          <FormOutlined />
          <div>
            <div className="dashboard-kicker">答题脚手架</div>
            <h2>{scaffold.title}</h2>
            <p>{scaffold.summary}</p>
          </div>
        </div>
        <div className="practice-answer-scaffold-actions">
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyScaffold}>
            复制脚手架
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => onUseTemplate(scaffold.answerTemplate)}
          >
            带入回答框
          </Button>
        </div>
      </div>

      <div className="practice-answer-scaffold-grid">
        {scaffold.bullets.map((item, index) => (
          <article key={item.key} className={`practice-answer-scaffold-card scaffold-${item.key}`}>
            <span>{index + 1}</span>
            <h3>{item.label}</h3>
            <p>{item.prompt}</p>
            <small>{item.hint}</small>
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
  return `${safeTitle || '题目'}-答题脚手架.md`
}
