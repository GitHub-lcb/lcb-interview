import { Progress } from 'antd'
import type { Question } from '../types'
import { calculateAnswerQuality, generateFollowUps, getMistakeHint } from '../utils/answerQuality'

interface Props {
  question: Question
}

export default function AnswerQualityPanel({ question }: Props) {
  const quality = calculateAnswerQuality(question)
  const followUps = generateFollowUps(question)

  return (
    <aside className="answer-quality-panel">
      <section className="quality-score-card">
        <div className="panel-kicker">答案质量</div>
        <div className="quality-score">{quality.score}</div>
        <Progress percent={quality.score} showInfo={false} strokeColor={quality.score >= 85 ? '#059669' : '#2563EB'} />
        <div className="panel-muted">
          {quality.level === 'excellent' ? '结构完整，可直接复述' : quality.level === 'good' ? '可用，建议补齐弱项' : '缺少关键面试模块'}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-title">面试官追问</div>
        <ol className="panel-list">
          {followUps.map(item => <li key={item}>{item}</li>)}
        </ol>
      </section>

      {quality.completedFields.length > 0 && (
        <section className="panel-card">
          <div className="panel-title">已覆盖模块</div>
          <div className="covered-field-list">
            {quality.completedFields.slice(0, 6).map(field => <span key={field}>{field}</span>)}
          </div>
        </section>
      )}

      <section className="panel-card warning">
        <div className="panel-title">不要这么答</div>
        <p>{getMistakeHint(question)}</p>
      </section>

      {quality.missingFields.length > 0 && (
        <section className="panel-card">
          <div className="panel-title">可补强模块</div>
          <div className="missing-field-list">
            {quality.missingFields.slice(0, 4).map(field => <span key={field}>{field}</span>)}
          </div>
        </section>
      )}
    </aside>
  )
}
