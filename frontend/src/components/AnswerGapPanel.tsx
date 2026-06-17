import { Button, Progress, message } from 'antd'
import { AuditOutlined, CopyOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { Question } from '../types'
import { buildAnswerGapMarkdown, buildAnswerGapReport } from '../utils/answerGap'

interface AnswerGapPanelProps {
  question: Question
  answer: string
}

export default function AnswerGapPanel({ question, answer }: AnswerGapPanelProps) {
  const report = useMemo(() => buildAnswerGapReport(question, answer), [answer, question])

  const handleCopyReport = async () => {
    const markdown = buildAnswerGapMarkdown(question, answer)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('答案差距校准已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    message.warning('剪贴板不可用，已下载 Markdown 校准')
  }

  return (
    <section className={`answer-gap-panel level-${report.level}`} aria-label="答案差距校准">
      <div className="answer-gap-head">
        <div>
          <div className="dashboard-kicker">答案差距校准</div>
          <h2>{report.title}</h2>
          <p>{report.summary}</p>
        </div>
        <div className="answer-gap-head-actions">
          <div className="answer-gap-score">
            <AuditOutlined />
            <strong>{report.score}</strong>
          </div>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReport}>
            复制校准
          </Button>
        </div>
      </div>

      <Progress percent={report.score} showInfo={false} strokeColor={report.score >= 75 ? '#059669' : '#D97706'} />

      <div className="answer-gap-grid">
        {report.modules.map(module => (
          <article key={module.key} className={`answer-gap-module status-${module.status}`}>
            <div>
              <span>{module.label}</span>
              <strong>{module.score}</strong>
            </div>
            <p>{module.evidence}</p>
            <small>{module.guidance}</small>
          </article>
        ))}
      </div>

      <div className="answer-gap-outline">
        <span>重写提纲</span>
        <ol>
          {report.rewriteOutline.map(item => <li key={item}>{item}</li>)}
        </ol>
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

function buildFileName(title: string): string {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeTitle || '题目'}-答案差距校准.md`
}
