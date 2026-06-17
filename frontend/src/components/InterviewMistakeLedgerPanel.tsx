import { Button, Progress } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  FireOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  InterviewMistakeLedgerItem,
  InterviewMistakeLedgerItemType,
  StudyProgress,
} from '../types'
import { buildInterviewMistakeLedger } from '../utils/interviewMistakeLedger'

interface InterviewMistakeLedgerPanelProps {
  progress: StudyProgress
}

const itemIcons: Record<InterviewMistakeLedgerItemType, JSX.Element> = {
  criterion: <WarningOutlined />,
  'weak-unspoken': <FireOutlined />,
  advanced: <BookOutlined />,
}

function scoreColor(item: InterviewMistakeLedgerItem): string {
  if (item.type === 'advanced') {
    return '#059669'
  }
  if (item.averageScore > 0 && item.averageScore < 50) {
    return '#DC2626'
  }
  return '#D97706'
}

function metricText(item: InterviewMistakeLedgerItem): string {
  if (item.type === 'weak-unspoken') {
    return `${item.affectedQuestionIds.length} 道待开口`
  }
  return `${item.averageScore} 平均分`
}

export default function InterviewMistakeLedgerPanel({ progress }: InterviewMistakeLedgerPanelProps) {
  const navigate = useNavigate()
  const ledger = useMemo(() => buildInterviewMistakeLedger(progress), [progress])

  if (ledger.level === 'empty') {
    return (
      <section className="interview-mistake-panel level-empty" aria-label="面试错因本">
        <div className="interview-mistake-heading">
          <div>
            <div className="dashboard-kicker">面试错因本</div>
            <h2>{ledger.title}</h2>
            <p>{ledger.summary}</p>
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(ledger.primaryAction.to)}>
            {ledger.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className={`interview-mistake-panel level-${ledger.level}`} aria-label="面试错因本">
      <div className="interview-mistake-heading">
        <div>
          <div className="dashboard-kicker">面试错因本</div>
          <h2>{ledger.title}</h2>
          <p>{ledger.summary}</p>
        </div>
        <div className="interview-mistake-action">
          <span>{ledger.primaryAction.description}</span>
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(ledger.primaryAction.to)}>
            {ledger.primaryAction.label}
          </Button>
        </div>
      </div>

      <div className="interview-mistake-grid">
        {ledger.items.map(item => (
          <article
            key={item.id}
            className={`interview-mistake-card type-${item.type} ${item.criterionKey ? `criterion-${item.criterionKey}` : ''}`}
          >
            <div className="interview-mistake-card-top">
              <span>{itemIcons[item.type]}</span>
              <em>{metricText(item)}</em>
            </div>
            <h3>{item.label}</h3>
            <p>{item.summary}</p>
            <div className="interview-mistake-score">
              <Progress
                percent={item.type === 'weak-unspoken' ? 0 : item.averageScore}
                showInfo={false}
                strokeColor={scoreColor(item)}
              />
              <small>{item.latestQuestionTitle}</small>
            </div>
            <Button type={item === ledger.items[0] ? 'primary' : 'default'} onClick={() => navigate(item.to)}>
              {item.actionLabel}
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
