import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ForwardOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import { useMemo } from 'react'
import type {
  InterviewFeedback,
  PracticeFeedbackClosureAction,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'
import { buildPracticeFeedbackClosure, buildPracticeFeedbackClosureMarkdown } from '../utils/practiceFeedbackClosure'

interface PracticeFeedbackClosurePanelProps {
  question: PracticeQueueItem | QuestionSnapshot
  answer: string
  feedback: InterviewFeedback
  onUsePrompt: (prompt: string) => void
  onMarkWeak: () => void
  onMarkMastered: () => void
  onOpenAnswer: () => void
  answerActionLabel?: string
  onNext: () => void
}

const actionIcons: Record<PracticeFeedbackClosureAction['kind'], JSX.Element> = {
  rewrite: <EditOutlined />,
  'follow-up': <QuestionCircleOutlined />,
  weak: <ExclamationCircleOutlined />,
  mastered: <CheckCircleOutlined />,
  answer: <FileTextOutlined />,
  next: <ForwardOutlined />,
}

export default function PracticeFeedbackClosurePanel({
  question,
  answer,
  feedback,
  onUsePrompt,
  onMarkWeak,
  onMarkMastered,
  onOpenAnswer,
  answerActionLabel,
  onNext,
}: PracticeFeedbackClosurePanelProps) {
  const closure = useMemo(
    () => buildPracticeFeedbackClosure(question, answer, feedback),
    [answer, feedback, question],
  )

  const handleAction = (action: PracticeFeedbackClosureAction) => {
    if ((action.kind === 'rewrite' || action.kind === 'follow-up') && action.prompt) {
      onUsePrompt(action.prompt)
      return
    }
    if (action.kind === 'weak') {
      onMarkWeak()
      return
    }
    if (action.kind === 'mastered') {
      onMarkMastered()
      return
    }
    if (action.kind === 'answer') {
      onOpenAnswer()
      return
    }
    if (action.kind === 'next') {
      onNext()
    }
  }

  const handleCopyReport = async () => {
    const markdown = buildPracticeFeedbackClosureMarkdown(question, answer, feedback)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('单题评分闭环已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 闭环')
  }

  return (
    <section className={`practice-feedback-closure-panel level-${closure.level}`} aria-label="面试后闭环教练">
      <div className="practice-feedback-closure-head">
        <div>
          <div className="dashboard-kicker">面试后闭环教练</div>
          <h2>{closure.title}</h2>
          <p>{closure.summary}</p>
        </div>
        <div className="practice-feedback-closure-head-actions">
          <span>{closure.primaryAction.label}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReport}>
            复制闭环
          </Button>
        </div>
      </div>

      <div className="practice-feedback-closure-metrics">
        {closure.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className="practice-feedback-closure-actions">
        {closure.actions.map(action => {
          const actionLabel = action.kind === 'answer' && answerActionLabel ? answerActionLabel : action.label

          return (
            <Button
              key={action.kind}
              type={action.tone === 'primary' || action.tone === 'success' ? 'primary' : 'default'}
              danger={action.tone === 'danger'}
              icon={actionIcons[action.kind]}
              onClick={() => handleAction(action)}
            >
              {actionLabel}
              <ArrowRightOutlined />
            </Button>
          )
        })}
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
  return `${safeTitle || '题目'}-单题评分闭环.md`
}
