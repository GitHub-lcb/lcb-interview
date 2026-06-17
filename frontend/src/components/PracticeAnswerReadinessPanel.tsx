import { CheckCircleOutlined, ExclamationCircleOutlined, ToolOutlined } from '@ant-design/icons'
import { Button, Progress } from 'antd'
import { useMemo } from 'react'
import type { PracticeQueueItem } from '../types'
import { buildPracticeAnswerRepairAction } from '../utils/practiceAnswerRepairAction'
import { analyzePracticeAnswerReadiness } from '../utils/practiceAnswerReadiness'

interface PracticeAnswerReadinessPanelProps {
  question: PracticeQueueItem
  answer: string
  onUseRepairTemplate?: (template: string) => void
}

export default function PracticeAnswerReadinessPanel({
  question,
  answer,
  onUseRepairTemplate,
}: PracticeAnswerReadinessPanelProps) {
  const readiness = useMemo(
    () => analyzePracticeAnswerReadiness(question, answer),
    [answer, question],
  )
  const repairAction = useMemo(
    () => buildPracticeAnswerRepairAction(question, answer),
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
          <div className="practice-answer-readiness-next">
            <small>{readiness.nextAction}</small>
            {onUseRepairTemplate && (
              <Button
                size="small"
                type="primary"
                icon={<ToolOutlined />}
                onClick={() => onUseRepairTemplate(repairAction.template)}
              >
                {repairAction.label}
              </Button>
            )}
          </div>
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
