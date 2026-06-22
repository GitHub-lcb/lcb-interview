import {
  FallOutlined,
  MinusCircleOutlined,
  RetweetOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { Button, Progress } from 'antd'
import { useMemo } from 'react'
import type { InterviewAttempt, PracticeQueueItem } from '../types'
import type { PracticeAttemptDeltaLevel, PracticeAttemptDeltaTone } from '../utils/practiceAttemptDelta'
import { buildPracticeAttemptDelta } from '../utils/practiceAttemptDelta'

interface PracticeAttemptDeltaPanelProps {
  question: PracticeQueueItem
  attempts: InterviewAttempt[]
  onUsePrompt: (prompt: string) => void
}

const levelLabels: Record<PracticeAttemptDeltaLevel, string> = {
  empty: '待评分',
  single: '待重答',
  improved: '已提升',
  regressed: '需回炉',
  stable: '待突破',
}

const toneIcons: Record<PracticeAttemptDeltaTone, JSX.Element> = {
  up: <RiseOutlined />,
  down: <FallOutlined />,
  same: <MinusCircleOutlined />,
}

export default function PracticeAttemptDeltaPanel({
  question,
  attempts,
  onUsePrompt,
}: PracticeAttemptDeltaPanelProps) {
  const delta = useMemo(
    () => buildPracticeAttemptDelta(question, attempts),
    [attempts, question],
  )

  return (
    <section className={`practice-attempt-delta-panel level-${delta.level}`} aria-label="本题重答验收">
      <div className="practice-side-title-row">
        <div className="practice-side-title">本题重答验收</div>
        <small>{levelLabels[delta.level]}</small>
      </div>

      <div className="practice-attempt-delta-main">
        <div>
          <span>{delta.title}</span>
          <strong>{delta.latestScore}</strong>
          <small>{delta.previousScore === undefined ? '首轮基线' : `上次 ${delta.previousScore} 分`}</small>
        </div>
        <em className={`tone-${resolveDeltaTone(delta.scoreDelta)}`}>
          {formatSigned(delta.scoreDelta)}
        </em>
      </div>

      <p className="practice-attempt-delta-summary">{delta.summary}</p>

      {delta.criterionDeltas.length > 0 && (
        <div className="practice-attempt-delta-criteria">
          {delta.criterionDeltas.map(item => (
            <article key={item.key} className={`tone-${item.tone}`}>
              <div>
                <span>{item.label}</span>
                <em>
                  {toneIcons[item.tone]}
                  {formatCriterionDelta(item.delta)}
                </em>
              </div>
              <Progress
                percent={item.latestScore}
                showInfo={false}
                strokeColor={resolveProgressColor(item.tone, item.latestScore)}
              />
              <small>当前 {item.latestScore} 分 · 上次 {item.previousScore} 分</small>
            </article>
          ))}
        </div>
      )}

      <div className="practice-attempt-delta-action-wrap">
        <small>{delta.primaryAction.description}</small>
        <Button
          className="practice-attempt-delta-action"
          type="primary"
          icon={<RetweetOutlined />}
          onClick={() => onUsePrompt(delta.primaryAction.prompt)}
        >
          {delta.primaryAction.label}
        </Button>
      </div>
    </section>
  )
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value}`
  }
  return String(value)
}

function formatCriterionDelta(value: number): string {
  return `${formatSigned(value)} 分`
}

function resolveDeltaTone(value: number): PracticeAttemptDeltaTone {
  if (value > 0) {
    return 'up'
  }
  if (value < 0) {
    return 'down'
  }
  return 'same'
}

function resolveProgressColor(tone: PracticeAttemptDeltaTone, latestScore: number): string {
  if (tone === 'down') {
    return '#DC2626'
  }
  if (latestScore >= 80) {
    return '#059669'
  }
  if (latestScore >= 60) {
    return '#2563EB'
  }
  return '#D97706'
}
