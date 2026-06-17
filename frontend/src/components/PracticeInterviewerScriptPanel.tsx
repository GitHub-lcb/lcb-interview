import { ClockCircleOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, message, Progress } from 'antd'
import { useMemo } from 'react'
import type { InterviewAttempt, PracticeQueueItem } from '../types'
import type { PracticeInterviewerScriptLevel } from '../utils/practiceInterviewerScript'
import { buildPracticeInterviewerScriptMarkdown } from '../utils/practiceInterviewerScript'
import {
  buildPracticeInterviewerScriptProgress,
  type PracticeInterviewerScriptStepStatus,
} from '../utils/practiceInterviewerScriptProgress'

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

const stepStatusLabels: Record<PracticeInterviewerScriptStepStatus, string> = {
  pending: '待练',
  attempted: '修复中',
  passed: '已通过',
}

const stepActionLabels: Record<PracticeInterviewerScriptStepStatus, string> = {
  pending: '带入回答框',
  attempted: '继续修复',
  passed: '重练这一问',
}

export default function PracticeInterviewerScriptPanel({
  question,
  attempts,
  onUsePrompt,
}: PracticeInterviewerScriptPanelProps) {
  const scriptProgress = useMemo(
    () => buildPracticeInterviewerScriptProgress(question, attempts),
    [attempts, question],
  )
  const { script } = scriptProgress

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

      <div className="practice-interviewer-script-progress">
        <div className="practice-interviewer-script-progress-top">
          <span>
            脚本进度 {scriptProgress.passedCount} / {scriptProgress.totalSteps}
          </span>
          <small>{scriptProgress.summary}</small>
        </div>
        <Progress percent={scriptProgress.progressPercent} showInfo={false} />
      </div>

      <div className="practice-interviewer-script-steps">
        {scriptProgress.steps.map((progressItem, index) => {
          const item = progressItem.step
          const buttonType = progressItem.status === 'pending' && index === 0 ? 'primary' : 'default'

          return (
            <article
              key={item.id}
              className={`practice-interviewer-script-step criterion-${item.criterionKey} status-${progressItem.status}`}
            >
              <div className="practice-interviewer-script-step-top">
                <span>第 {index + 1} 问</span>
                <div className="practice-interviewer-script-step-badges">
                  <strong className={`practice-interviewer-script-status status-${progressItem.status}`}>
                    {stepStatusLabels[progressItem.status]}
                  </strong>
                  <em>{item.durationSeconds} 秒</em>
                </div>
              </div>
              <h4>{item.title}</h4>
              <p>{item.prompt}</p>
              <small>{item.pressurePoint}</small>
              <div className="practice-interviewer-script-hint">{item.answerHint}</div>
              <Button size="small" type={buttonType} onClick={() => onUsePrompt(item.prompt)}>
                {stepActionLabels[progressItem.status]}
              </Button>
            </article>
          )
        })}
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
