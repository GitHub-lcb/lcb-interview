import { Button } from 'antd'
import { ArrowRightOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { InterviewFeedback, PracticeQueueItem } from '../types'
import { buildFollowUpDrillPack } from '../utils/followUpDrill'

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

  return (
    <section className="follow-up-drill-panel" aria-label="追问加压训练">
      <div className="follow-up-drill-head">
        <div>
          <div className="dashboard-kicker">追问加压训练</div>
          <h2>{pack.title}</h2>
          <p>{pack.summary}</p>
        </div>
        <ThunderboltOutlined />
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
