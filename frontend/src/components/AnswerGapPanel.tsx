import { Progress } from 'antd'
import { AuditOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { Question } from '../types'
import { buildAnswerGapReport } from '../utils/answerGap'

interface AnswerGapPanelProps {
  question: Question
  answer: string
}

export default function AnswerGapPanel({ question, answer }: AnswerGapPanelProps) {
  const report = useMemo(() => buildAnswerGapReport(question, answer), [answer, question])

  return (
    <section className={`answer-gap-panel level-${report.level}`} aria-label="答案差距校准">
      <div className="answer-gap-head">
        <div>
          <div className="dashboard-kicker">答案差距校准</div>
          <h2>{report.title}</h2>
          <p>{report.summary}</p>
        </div>
        <div className="answer-gap-score">
          <AuditOutlined />
          <strong>{report.score}</strong>
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
