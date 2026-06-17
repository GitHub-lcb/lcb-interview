import { ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import type { InterviewAttempt, PracticeQueueItem } from '../types'
import type { PracticeInterviewerScriptLevel } from '../utils/practiceInterviewerScript'
import { buildPracticeInterviewerScript } from '../utils/practiceInterviewerScript'

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
