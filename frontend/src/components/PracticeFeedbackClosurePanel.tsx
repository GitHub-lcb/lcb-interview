import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ForwardOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import type {
  InterviewFeedback,
  PracticeFeedbackClosureAction,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'
import { buildPracticeFeedbackClosure } from '../utils/practiceFeedbackClosure'

interface PracticeFeedbackClosurePanelProps {
  question: PracticeQueueItem | QuestionSnapshot
  answer: string
  feedback: InterviewFeedback
  onUsePrompt: (prompt: string) => void
  onMarkWeak: () => void
  onMarkMastered: () => void
  onOpenAnswer: () => void
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

  return (
    <section className={`practice-feedback-closure-panel level-${closure.level}`} aria-label="面试后闭环教练">
      <div className="practice-feedback-closure-head">
        <div>
          <div className="dashboard-kicker">面试后闭环教练</div>
          <h2>{closure.title}</h2>
          <p>{closure.summary}</p>
        </div>
        <span>{closure.primaryAction.label}</span>
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
        {closure.actions.map(action => (
          <Button
            key={action.kind}
            type={action.tone === 'primary' || action.tone === 'success' ? 'primary' : 'default'}
            danger={action.tone === 'danger'}
            icon={actionIcons[action.kind]}
            onClick={() => handleAction(action)}
          >
            {action.label}
            <ArrowRightOutlined />
          </Button>
        ))}
      </div>
    </section>
  )
}
