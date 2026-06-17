import { Button, message, Progress } from 'antd'
import { ArrowRightOutlined, CopyOutlined, LineChartOutlined, WarningOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InterviewTrend, StudyProgress } from '../types'
import { buildInterviewReviewMarkdown, buildInterviewReviewSummary } from '../utils/interviewReview'

interface InterviewReviewPanelProps {
  progress: StudyProgress
  compact?: boolean
}

const trendLabels: Record<InterviewTrend, string> = {
  empty: '等待首评',
  improving: '正在上升',
  declining: '需要复盘',
  stable: '稳定推进',
}

function trendTone(trend: InterviewTrend) {
  if (trend === 'improving') {
    return 'strong'
  }
  if (trend === 'declining') {
    return 'weak'
  }
  if (trend === 'empty') {
    return 'empty'
  }
  return 'pass'
}

function formatAttemptTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未知'
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function InterviewReviewPanel({ progress, compact = false }: InterviewReviewPanelProps) {
  const navigate = useNavigate()
  const summary = useMemo(() => buildInterviewReviewSummary(progress), [progress])
  const tone = trendTone(summary.trend)

  const handleCopyReview = async () => {
    const markdown = buildInterviewReviewMarkdown(progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('模拟面试复盘已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 复盘')
  }

  if (summary.totalAttempts === 0) {
    return (
      <section className={`interview-review-panel is-empty ${compact ? 'compact' : ''}`} aria-label="模拟面试复盘">
        <div className="interview-review-heading">
          <div>
            <div className="dashboard-kicker">免费模拟面试复盘</div>
            <h2>还没有面试表达记录</h2>
            <p>{summary.recommendation}</p>
          </div>
          <div className="interview-review-heading-actions">
            <LineChartOutlined />
            <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReview}>
              复制复盘
            </Button>
          </div>
        </div>
        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate('/practice')}>
          开始模拟面试
        </Button>
      </section>
    )
  }

  return (
    <section className={`interview-review-panel tone-${tone} ${compact ? 'compact' : ''}`} aria-label="模拟面试复盘">
      <div className="interview-review-heading">
        <div>
          <div className="dashboard-kicker">免费模拟面试复盘</div>
          <h2>表达能力复盘</h2>
          <p>{summary.recommendation}</p>
        </div>
        <div className="interview-review-heading-actions">
          <span className={`interview-trend-badge tone-${tone}`}>
            {summary.trend === 'declining' ? <WarningOutlined /> : <LineChartOutlined />}
            {trendLabels[summary.trend]}
          </span>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReview}>
            复制复盘
          </Button>
        </div>
      </div>

      <div className="interview-review-body">
        <div className="interview-review-score">
          <span>平均分</span>
          <strong>{summary.averageScore}</strong>
          <Progress percent={summary.averageScore} showInfo={false} strokeColor={summary.averageScore >= 80 ? '#059669' : '#2563EB'} />
          {summary.latestScore !== undefined && <small>最近一次 {summary.latestScore} 分</small>}
        </div>

        <div className="interview-review-content">
          <div className="interview-review-metrics">
            <div>
              <span>练习次数</span>
              <strong>{summary.totalAttempts}</strong>
            </div>
            <div>
              <span>覆盖题目</span>
              <strong>{summary.answeredQuestions}</strong>
            </div>
            <div>
              <span>最高分</span>
              <strong>{summary.bestScore}</strong>
            </div>
          </div>

          {summary.weakestCriterion && (
            <div className="interview-review-weakest">
              <span>当前最弱维度</span>
              <strong>{summary.weakestCriterion.label} · {summary.weakestCriterion.averageScore} 分</strong>
              <small>{summary.weakestCriterion.summary}</small>
            </div>
          )}

          {!compact && (
            <div className="interview-review-recent">
              <span>最近记录</span>
              {summary.recentAttempts.map(attempt => (
                <button key={`${attempt.questionId}-${attempt.createdAt}`} onClick={() => navigate(`/question/${attempt.questionId}`)}>
                  <strong>{attempt.question?.title}</strong>
                  <small>{attempt.feedback.score} 分 · {formatAttemptTime(attempt.createdAt)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
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
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-模拟面试复盘.md`
}
