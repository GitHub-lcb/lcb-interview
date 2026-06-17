import { Button, message, Progress } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  CopyOutlined,
  FireOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  InterviewMistakeLedgerItem,
  InterviewMistakeLedgerItemType,
  InterviewRecoveryAcceptance,
  InterviewRecoveryPlan,
  StudyProgress,
} from '../types'
import { buildInterviewMistakeLedger } from '../utils/interviewMistakeLedger'
import { buildInterviewRecoveryAcceptance } from '../utils/interviewRecoveryAcceptance'
import { buildInterviewRecoveryPlan } from '../utils/interviewRecoveryPlan'
import { buildInterviewRecoveryMarkdown } from '../utils/interviewRecoveryReport'

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

function renderRecoveryPlan(
  plan: InterviewRecoveryPlan,
  onNavigate: (to: string) => void,
  onCopy: () => void,
) {
  return (
    <div className={`interview-recovery-plan mode-${plan.mode}`}>
      <div className="interview-recovery-head">
        <div>
          <span>{plan.totalMinutes} 分钟闭环</span>
          <h3>{plan.title}</h3>
          <p>{plan.summary}</p>
        </div>
        <Button icon={<CopyOutlined />} onClick={onCopy}>
          复制计划
        </Button>
      </div>
      <div className="interview-recovery-steps">
        {plan.steps.map((step, index) => (
          <article key={step.id} className="interview-recovery-step">
            <div className="interview-recovery-step-index">{index + 1}</div>
            <div>
              <div className="interview-recovery-step-top">
                <strong>{step.title}</strong>
                <em>{step.durationMinutes} 分钟</em>
              </div>
              <p>{step.description}</p>
              <small>{step.reason}</small>
              <Button type={index === 0 ? 'primary' : 'default'} size="small" onClick={() => onNavigate(step.to)}>
                {step.actionLabel}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function renderAcceptance(
  acceptance: InterviewRecoveryAcceptance,
  onNavigate: (to: string) => void,
) {
  return (
    <div className={`interview-acceptance-strip status-${acceptance.status}`}>
      <div>
        <span>{acceptance.passedCount} / {acceptance.totalCount} 已验收</span>
        <strong>{acceptance.title}</strong>
        <p>{acceptance.summary}</p>
      </div>
      <Button
        type={acceptance.status === 'passed' ? 'default' : 'primary'}
        icon={<ArrowRightOutlined />}
        onClick={() => onNavigate(acceptance.primaryAction.to)}
      >
        {acceptance.primaryAction.label}
      </Button>
    </div>
  )
}

export default function InterviewMistakeLedgerPanel({ progress }: InterviewMistakeLedgerPanelProps) {
  const navigate = useNavigate()
  const ledger = useMemo(() => buildInterviewMistakeLedger(progress), [progress])
  const recoveryPlan = useMemo(() => buildInterviewRecoveryPlan(ledger), [ledger])
  const acceptance = useMemo(() => buildInterviewRecoveryAcceptance(progress, ledger), [progress, ledger])
  const handleCopyRecoveryPlan = async () => {
    const markdown = buildInterviewRecoveryMarkdown(ledger, recoveryPlan, progress.targetRole)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('错因修复计划已复制')
      return
    }

    downloadMarkdown(markdown, buildRecoveryFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 计划')
  }

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
        {renderRecoveryPlan(recoveryPlan, navigate, handleCopyRecoveryPlan)}
        {renderAcceptance(acceptance, navigate)}
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

      {renderRecoveryPlan(recoveryPlan, navigate, handleCopyRecoveryPlan)}
      {renderAcceptance(acceptance, navigate)}
    </section>
  )
}

async function copyMarkdown(markdown: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(markdown)
    return true
  } catch {
    return false
  }
}

function downloadMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function buildRecoveryFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '面试'}-错因修复计划.md`
}
