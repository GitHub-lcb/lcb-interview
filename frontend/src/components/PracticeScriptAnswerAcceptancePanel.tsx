import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Progress } from 'antd'
import { useMemo } from 'react'
import type { InterviewAttempt, PracticeQueueItem } from '../types'
import { analyzePracticeScriptAnswerAcceptance } from '../utils/practiceScriptAnswerAcceptance'

interface PracticeScriptAnswerAcceptancePanelProps {
  question: PracticeQueueItem
  attempts: InterviewAttempt[]
  answer: string
}

export default function PracticeScriptAnswerAcceptancePanel({
  question,
  attempts,
  answer,
}: PracticeScriptAnswerAcceptancePanelProps) {
  const acceptance = useMemo(
    () => analyzePracticeScriptAnswerAcceptance(question, attempts, answer),
    [answer, attempts, question],
  )

  return (
    <section
      className={`practice-script-answer-acceptance-panel level-${acceptance.level}`}
      aria-label="追问回答验收"
    >
      <div className="practice-script-answer-acceptance-score">
        <div>
          <span>追问回答验收</span>
          <strong>{acceptance.score}</strong>
        </div>
        <Progress
          percent={acceptance.score}
          showInfo={false}
          strokeColor={acceptance.score >= 75 ? '#059669' : acceptance.score >= 50 ? '#2563EB' : '#D97706'}
        />
      </div>

      <div className="practice-script-answer-acceptance-main">
        <div>
          <div className="practice-script-answer-acceptance-title-row">
            <h3>{acceptance.title}</h3>
            {acceptance.criterionLabel && <span>{acceptance.criterionLabel}</span>}
          </div>
          <p>{acceptance.summary}</p>
          <small className="practice-script-answer-acceptance-next">{acceptance.nextAction}</small>
        </div>

        <div className="practice-script-answer-acceptance-items">
          {acceptance.items.map(item => (
            <div key={item.key} className={item.covered ? 'covered' : 'missing'}>
              {item.covered ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              <span>{item.label}</span>
              <small>{item.covered ? item.evidence : `缺口：${item.guidance}`}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
