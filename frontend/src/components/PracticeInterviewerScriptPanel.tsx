import { ClockCircleOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useMemo } from 'react'
import type { InterviewAttempt, PracticeQueueItem } from '../types'
import type { PracticeInterviewerScriptLevel } from '../utils/practiceInterviewerScript'
import {
  buildPracticeInterviewerScript,
  buildPracticeInterviewerScriptMarkdown,
} from '../utils/practiceInterviewerScript'

interface PracticeInterviewerScriptPanelProps {
  question: PracticeQueueItem
  attempts: InterviewAttempt[]
  onUsePrompt: (prompt: string) => void
}

const levelLabels: Record<PracticeInterviewerScriptLevel, string> = {
  warmup: '预热',
  repair: '修复',
  pressure: '加压',
  advanced: '高级',
  regression: '回落',
}

export default function PracticeInterviewerScriptPanel({
  question,
  attempts,
  onUsePrompt,
}: PracticeInterviewerScriptPanelProps) {
  const script = useMemo(
    () => buildPracticeInterviewerScript(question, attempts),
    [attempts, question],
  )

  const handleCopyScript = async () => {
    const markdown = buildPracticeInterviewerScriptMarkdown(question, attempts)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('本题面试官脚本已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    message.warning('剪贴板不可用，已下载 Markdown 脚本')
  }

  return (
    <section
      className={`practice-interviewer-script-panel level-${script.level}`}
      aria-label="本题面试官脚本"
    >
      <div className="practice-interviewer-script-head">
        <div>
          <div className="dashboard-kicker">
            <ThunderboltOutlined />
            本题面试官脚本
          </div>
          <h3>{script.title}</h3>
          <p>{script.summary}</p>
        </div>
        <div className="practice-interviewer-script-meta">
          <span>{levelLabels[script.level]}</span>
          <small>
            <ClockCircleOutlined />
            {formatDuration(script.totalSeconds)}
          </small>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyScript}>
            复制脚本
          </Button>
        </div>
      </div>

      <div className="practice-interviewer-script-steps">
        {script.steps.map((item, index) => (
          <article key={item.id} className={`practice-interviewer-script-step criterion-${item.criterionKey}`}>
            <div className="practice-interviewer-script-step-top">
              <span>第 {index + 1} 问</span>
              <em>{item.durationSeconds} 秒</em>
            </div>
            <h4>{item.title}</h4>
            <p>{item.prompt}</p>
            <small>{item.pressurePoint}</small>
            <div className="practice-interviewer-script-hint">{item.answerHint}</div>
            <Button size="small" type={index === 0 ? 'primary' : 'default'} onClick={() => onUsePrompt(item.prompt)}>
              带入回答框
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(totalSeconds / 60))
  return `${minutes} 分钟`
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
  return `${safeTitle || '题目'}-本题面试官脚本.md`
}
