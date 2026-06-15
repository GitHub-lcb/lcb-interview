import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Input, Progress } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { evaluateInterviewAnswerRemote } from '../../api/interview'
import type { InterviewFeedback, PracticeQueueItem } from '../../types'
import { evaluateInterviewAnswer } from '../../utils/interviewCoach'
import { buildPracticeQueue, summarizeProgress } from '../../utils/studyProgress'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
const sourceLabels: Record<PracticeQueueItem['source'], string> = {
  review: '复习优先',
  plan: '今日计划',
  new: '新题训练',
}

const feedbackLevelLabels: Record<InterviewFeedback['level'], string> = {
  strong: '强',
  pass: '可通过',
  'needs-work': '需补强',
}

const feedbackSourceLabels: Record<NonNullable<InterviewFeedback['source']>, string> = {
  AI: 'AI评分',
  RULE_BASED: '后端规则',
  LOCAL_RULE_BASED: '本地规则',
}

function resolveScoreTone(score?: number) {
  if (score === undefined) {
    return 'empty'
  }
  if (score >= 80) {
    return 'strong'
  }
  if (score >= 60) {
    return 'pass'
  }
  return 'weak'
}

function resolveScoreHint(score?: number) {
  if (score === undefined) {
    return '本题暂无记录'
  }
  if (score >= 80) {
    return '表达稳定'
  }
  if (score >= 60) {
    return '可进入追问'
  }
  return '需要补强'
}

export default function Practice() {
  const navigate = useNavigate()
  const { getState, progress, recordInterviewAttempt, setInPlan, setStatus } = useStudyProgress()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answerDraft, setAnswerDraft] = useState('')
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const queue = useMemo(() => buildPracticeQueue(progress, [], 12), [progress])
  const summary = useMemo(() => summarizeProgress(progress), [progress])

  useEffect(() => {
    if (queue.length === 0 && currentIndex !== 0) {
      setCurrentIndex(0)
    }
    if (queue.length > 0 && currentIndex >= queue.length) {
      setCurrentIndex(queue.length - 1)
    }
  }, [currentIndex, queue.length])

  const current = queue[currentIndex]
  const currentState = current ? getState(current.id) : null
  const latestAttempt = current ? progress.interviewAttempts[current.id]?.[0] : undefined
  const progressPercent = queue.length === 0 ? 0 : Math.round(((currentIndex + 1) / queue.length) * 100)
  const answeredInQueue = queue.filter(item => (progress.interviewAttempts[item.id]?.length ?? 0) > 0).length
  const latestScore = feedback?.score ?? latestAttempt?.feedback.score
  const latestScoreTone = resolveScoreTone(latestScore)
  const latestScoreText = latestScore === undefined ? '待评分' : `${latestScore} 分`

  useEffect(() => {
    setAnswerDraft('')
    setFeedback(null)
  }, [current?.id])

  const moveNext = () => {
    setCurrentIndex(index => {
      if (queue.length <= 1) {
        return 0
      }
      return (index + 1) % queue.length
    })
  }

  const markWeak = () => {
    if (!current) {
      return
    }
    setStatus(current.id, 'weak')
    moveNext()
  }

  const markMastered = () => {
    if (!current) {
      return
    }
    setStatus(current.id, 'mastered')
    moveNext()
  }

  const submitAnswer = async () => {
    if (!current || !answerDraft.trim()) {
      return
    }
    setIsEvaluating(true)
    try {
      const remoteFeedback = await evaluateInterviewAnswerRemote(current, answerDraft.trim(), progress.targetRole)
      persistFeedback(remoteFeedback)
    } catch {
      const localFeedback = {
        ...evaluateInterviewAnswer(current, answerDraft.trim()),
        source: 'LOCAL_RULE_BASED' as const,
      }
      persistFeedback(localFeedback)
    } finally {
      setIsEvaluating(false)
    }
  }

  const persistFeedback = (nextFeedback: InterviewFeedback) => {
    if (!current) {
      return
    }
    setFeedback(nextFeedback)
    recordInterviewAttempt({
      questionId: current.id,
      answer: answerDraft.trim(),
      feedback: nextFeedback,
      createdAt: new Date().toISOString(),
    })
  }

  if (!current || !currentState) {
    return (
      <div className="practice-empty-page">
        <Empty description="还没有可训练题目">
          <Button type="primary" icon={<BookOutlined />} onClick={() => navigate('/')}>
            先浏览题目
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="practice-shell">
      <section className="practice-main">
        <div className="practice-header">
          <div className="practice-title-block">
            <div className="dashboard-kicker">今日面试训练</div>
            <h1>{progress.targetRole} · 第 {currentIndex + 1} 题</h1>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => setCurrentIndex(0)}>
            重开
          </Button>
        </div>

        <div className="practice-progress-row">
          <Progress percent={progressPercent} showInfo={false} strokeColor="#2563EB" />
          <span>{currentIndex + 1} / {queue.length}</span>
        </div>

        <div className="practice-session-strip" aria-label="本轮训练状态">
          <div>
            <span>已评分</span>
            <strong>{answeredInQueue} / {queue.length}</strong>
            <small>本轮队列</small>
          </div>
          <div>
            <span>当前来源</span>
            <strong>{sourceLabels[current.source]}</strong>
            <small>{current.categoryName}</small>
          </div>
          <div className={`score-${latestScoreTone}`}>
            <span>最近表现</span>
            <strong>{latestScoreText}</strong>
            <small>{resolveScoreHint(latestScore)}</small>
          </div>
        </div>

        <article className="practice-question">
          <div className="practice-question-top">
            <div className={`practice-source source-${current.source}`}>{sourceLabels[current.source]}</div>
            <span>Q{currentIndex + 1}</span>
          </div>
          <h2>{current.title}</h2>
          <div className="practice-meta">
            <span>{current.categoryName}</span>
            <span className={`difficulty-tag ${current.difficulty.toLowerCase()}`}>
              {difficultyLabels[current.difficulty] || current.difficulty}
            </span>
            <StudyStatusBadge status={currentState.status} addedToPlan={currentState.addedToPlan} />
          </div>
          {current.tags.length > 0 && (
            <div className="practice-tags">
              {current.tags.slice(0, 6).map(tag => <span key={tag}>{tag}</span>)}
            </div>
          )}
        </article>

        <section className="practice-answer-panel">
          <div className="practice-answer-title">
            <span>模拟面试回答</span>
            {latestAttempt && (
              <small className={`practice-latest-score score-${resolveScoreTone(latestAttempt.feedback.score)}`}>
                最近 {latestAttempt.feedback.score} 分
                {latestAttempt.feedback.source ? ` · ${feedbackSourceLabels[latestAttempt.feedback.source]}` : ''}
              </small>
            )}
          </div>
          <Input.TextArea
            value={answerDraft}
            onChange={(event) => setAnswerDraft(event.target.value)}
            placeholder="写下你会在面试中说出的答案..."
            autoSize={{ minRows: 5, maxRows: 9 }}
            maxLength={1600}
            showCount
          />
          <div className="practice-answer-actions">
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={isEvaluating}
              disabled={!answerDraft.trim()}
              onClick={submitAnswer}
            >
              提交评分
            </Button>
          </div>
        </section>

        {feedback && (
          <section className={`practice-feedback-panel level-${feedback.level}`}>
            <div className={`practice-feedback-score score-${resolveScoreTone(feedback.score)}`}>
              <span>面试官评分</span>
              <strong>{feedback.score}</strong>
              <small>{feedbackLevelLabels[feedback.level]}</small>
              {feedback.source && (
                <em>{feedbackSourceLabels[feedback.source]}</em>
              )}
            </div>
            <div className="practice-feedback-body">
              <div className="practice-criteria-grid">
                {feedback.criteria.map(item => (
                  <div key={item.key} className={`score-${resolveScoreTone(item.score)}`}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{item.score}</strong>
                    </div>
                    <Progress percent={item.score} showInfo={false} strokeColor={item.score >= 70 ? '#059669' : '#D97706'} />
                    <small>{item.summary}</small>
                  </div>
                ))}
              </div>
              <div className="practice-feedback-lists">
                {feedback.advice.length > 0 && (
                  <div className="practice-feedback-list">
                    <span>改进点</span>
                    {feedback.advice.map(item => <p key={item}>{item}</p>)}
                  </div>
                )}
                <div className="practice-feedback-list">
                  <span>追问</span>
                  {feedback.followUps.map(item => <p key={item}>{item}</p>)}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="practice-actions">
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(`/question/${current.id}`)}>
            打开答案
          </Button>
          <Button icon={<WarningOutlined />} danger onClick={markWeak}>
            标记薄弱
          </Button>
          <Button icon={<CheckOutlined />} onClick={markMastered}>
            已掌握
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setInPlan(current.id, !currentState.addedToPlan)}>
            {currentState.addedToPlan ? '移出计划' : '加入计划'}
          </Button>
          <Button onClick={moveNext}>
            下一题
          </Button>
        </div>
      </section>

      <aside className="practice-side">
        <div className="practice-stat-panel">
          <div className="practice-side-title-row">
            <div className="practice-side-title">本轮概览</div>
            <small>{queue.length} 题</small>
          </div>
          <div className="practice-stat-score">
            <span>掌握度</span>
            <strong>{summary.masteryRate}%</strong>
            <Progress percent={summary.masteryRate} showInfo={false} strokeColor="#059669" />
          </div>
          <div className="practice-side-metrics">
            <div>
              <span>已评分</span>
              <strong>{answeredInQueue}</strong>
            </div>
            <div>
              <span>薄弱</span>
              <strong>{summary.weak}</strong>
            </div>
          </div>
          {latestAttempt && <small className="practice-side-footnote">本题最近评分 {latestAttempt.feedback.score}</small>}
        </div>
        <div className="practice-queue-panel">
          <div className="practice-side-title-row">
            <div className="practice-side-title">训练队列</div>
            <small>{currentIndex + 1} / {queue.length}</small>
          </div>
          {queue.map((item, index) => (
            <button
              key={`${item.source}-${item.id}`}
              className={item.id === current.id ? 'active' : ''}
              aria-current={item.id === current.id ? 'step' : undefined}
              onClick={() => setCurrentIndex(index)}
            >
              <span className={`queue-index source-${item.source}`}>{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{sourceLabels[item.source]} · {item.categoryName}</small>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
