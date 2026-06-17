import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Progress } from 'antd'
import { useMemo } from 'react'
import type { PracticeQueueItem } from '../types'
import { analyzePracticeAnswerReadiness } from '../utils/practiceAnswerReadiness'

interface PracticeAnswerReadinessPanelProps {
  question: PracticeQueueItem
  answer: string
}

export default function PracticeAnswerReadinessPanel({
  question,
  answer,
}: PracticeAnswerReadinessPanelProps) {
  const readiness = useMemo(
    () => analyzePracticeAnswerReadiness(question, answer),
    [answer, question],
  )

  return (
    <section
      className={`practice-answer-readiness-panel level-${readiness.level}`}
      aria-label="回答结构实时检查"
    >
      <div className="practice-answer-readiness-score">
        <div>
          <span>回答结构实时检查</span>
          <strong>{readiness.score}</strong>
        </div>
        <Progress
          percent={readiness.score}
          showInfo={false}
          strokeColor={readiness.score >= 75 ? '#059669' : readiness.score >= 50 ? '#2563EB' : '#D97706'}
        />
      </div>

      <div className="practice-answer-readiness-main">
        <div>
          <h3>{readiness.title}</h3>
          <p>{readiness.summary}</p>
          <small>{readiness.nextAction}</small>
        </div>
        <div className="practice-answer-readiness-items">
          {readiness.items.map(item => (
            <div key={item.key} className={item.covered ? 'covered' : 'missing'}>
              {item.covered ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              <span>{item.label}</span>
              <small>{item.covered ? item.evidence : item.guidance}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
