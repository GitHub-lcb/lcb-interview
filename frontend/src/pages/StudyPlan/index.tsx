import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, InputNumber, message, Progress, Select } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  FireOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import StudyActionButtons from '../../components/StudyActionButtons'
import InterviewBriefPanel from '../../components/InterviewBriefPanel'
import InterviewMistakeLedgerPanel from '../../components/InterviewMistakeLedgerPanel'
import SprintReportActions from '../../components/SprintReportActions'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import StudyPaceCoachPanel from '../../components/StudyPaceCoachPanel'
import DailyPlanBriefPanel from '../../components/DailyPlanBriefPanel'
import DailyPlanCompletionPanel from '../../components/DailyPlanCompletionPanel'
import InterviewEmergencyKitPanel from '../../components/InterviewEmergencyKitPanel'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { getHotQuestions } from '../../api/question'
import type { Question, ReviewDueStatus } from '../../types'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from '../../utils/reviewSchedule'
import { buildDailyPlan, resolvePlanQuestions, summarizeProgress } from '../../utils/studyProgress'
import { buildPaceFilledDailyPlan } from '../../utils/studyPacePlan'
import { buildDailyPracticePath } from '../../utils/practiceRoute'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
const roleOptions = [
  { label: 'Java 后端', value: 'Java 后端' },
  { label: '全栈工程师', value: '全栈工程师' },
  { label: 'AI 大模型', value: 'AI 大模型' },
  { label: '前端工程师', value: '前端工程师' },
  { label: '系统架构师', value: '系统架构师' },
]

const dueStatusLabels: Record<ReviewDueStatus, string> = {
  overdue: '已逾期',
  'due-today': '今日到期',
  upcoming: '即将到期',
}

function formatScheduleDate(value?: string) {
  if (!value) {
    return '暂无'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '暂无'
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export default function StudyPlan() {
  const navigate = useNavigate()
  const {
    getState,
    progress,
    rememberQuestions,
    setDailyPlan,
    setInPlan,
    setStatus,
    updateSettings,
  } = useStudyProgress()
  const [hotQuestions, setHotQuestions] = useState<Question[]>([])
  const [isLoadingSeeds, setIsLoadingSeeds] = useState(true)
  const summary = summarizeProgress(progress)
  const generatedPlanIds = useMemo(
    () => buildDailyPlan(progress, hotQuestions, Math.max(progress.dailyPlan.length, 8)),
    [hotQuestions, progress],
  )
  const planQuestions = useMemo(() => resolvePlanQuestions(progress, hotQuestions, 8), [hotQuestions, progress])
  const reviewQueue = useMemo(() => buildScheduledReviewQueue(progress, new Date().toISOString(), 12), [progress])
  const reviewSummary = useMemo(() => summarizeReviewSchedule(reviewQueue), [reviewQueue])
  const trackedCount = Object.keys(progress.questionStates).length
  const canGeneratePlan = generatedPlanIds.length > 0
  const canFillPacePlan = hotQuestions.length > 0 || Object.keys(progress.questionSnapshots).length > 0

  useEffect(() => {
    let ignore = false

    getHotQuestions(12)
      .then(questions => {
        if (ignore) {
          return
        }
        setHotQuestions(questions)
        rememberQuestions(questions)
      })
      .catch(() => {
        if (!ignore) {
          setHotQuestions([])
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingSeeds(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [rememberQuestions])

  const handleGeneratePlan = () => {
    if (!canGeneratePlan) {
      return
    }
    setDailyPlan(generatedPlanIds)
  }

  const handleFillPacePlan = () => {
    const nextPlanIds = buildPaceFilledDailyPlan(progress, hotQuestions)
    const currentPlanKey = [...new Set(progress.dailyPlan)].join(',')
    const nextPlanKey = nextPlanIds.join(',')

    if (nextPlanIds.length === 0) {
      message.warning('暂无可补齐的题目，先进入题库添加题目')
      return
    }
    if (nextPlanKey === currentPlanKey) {
      message.warning('暂无可补齐的新增题目，先进入题库补充题源')
      return
    }

    setDailyPlan(nextPlanIds)
    message.success(`已按配速补齐到 ${nextPlanIds.length} 道今日计划`)
  }

  return (
    <div>
      <div className="study-plan-header">
        <div>
          <div className="dashboard-kicker">学习计划</div>
          <h1>{progress.targetRole} · 今日复习</h1>
          <p>从薄弱题开始复盘，再推进今日计划。这里的数据保存在本机。</p>
        </div>
        <div className="study-plan-header-actions">
          <Button
            icon={<ThunderboltOutlined />}
            loading={isLoadingSeeds}
            disabled={!canGeneratePlan}
            onClick={handleGeneratePlan}
          >
            生成今日计划
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(buildDailyPracticePath(progress.dailyPlan))}
          >
            开始训练
          </Button>
          <Button icon={<BookOutlined />} onClick={() => navigate('/banks')}>
            继续刷题
          </Button>
          <SprintReportActions progress={progress} />
        </div>
      </div>

      <section className="study-settings-panel">
        <div className="study-settings-title">
          <SettingOutlined />
          <div>
            <strong>备考目标</strong>
            <small>目标会影响工作台和训练页的节奏展示</small>
          </div>
        </div>
        <div className="study-settings-controls">
          <label>
            <span>方向</span>
            <Select
              value={progress.targetRole}
              options={roleOptions}
              onChange={(value) => updateSettings({ targetRole: value })}
            />
          </label>
          <label>
            <span>周期</span>
            <div className="study-sprint-input">
              <InputNumber
                min={7}
                max={60}
                value={progress.sprintDays}
                onChange={(value) => updateSettings({ sprintDays: value })}
              />
              <em>天</em>
            </div>
          </label>
        </div>
      </section>

      <StudyPaceCoachPanel
        progress={progress}
        canFillPlan={canFillPacePlan}
        isFillingPlan={isLoadingSeeds}
        onFillPlan={handleFillPacePlan}
      />
      <DailyPlanBriefPanel progress={progress} candidates={hotQuestions} />
      <DailyPlanCompletionPanel progress={progress} />
      <InterviewEmergencyKitPanel progress={progress} />
      <InterviewBriefPanel progress={progress} />
      <InterviewMistakeLedgerPanel progress={progress} />

      <div className="study-plan-metrics">
        <div>
          <span>掌握度</span>
          <strong>{summary.masteryRate}%</strong>
          <Progress percent={summary.masteryRate} showInfo={false} strokeColor="#059669" />
        </div>
        <div>
          <span>薄弱题</span>
          <strong>{summary.weak}</strong>
          <small>优先复盘</small>
        </div>
        <div>
          <span>学习中</span>
          <strong>{summary.learning}</strong>
          <small>继续巩固</small>
        </div>
        <div>
          <span>已跟踪</span>
          <strong>{trackedCount}</strong>
          <small>本机记录</small>
        </div>
      </div>

      <section className="review-schedule-band" aria-label="智能复习排期">
        <div className="overdue">
          <span>已逾期</span>
          <strong>{reviewSummary.overdue}</strong>
          <small>优先补回</small>
        </div>
        <div className="due-today">
          <span>今日到期</span>
          <strong>{reviewSummary.dueToday}</strong>
          <small>今天必须复盘</small>
        </div>
        <div className="upcoming">
          <span>即将到期</span>
          <strong>{reviewSummary.upcoming}</strong>
          <small>后续巩固</small>
        </div>
        <div>
          <span>下次复习</span>
          <strong>{formatScheduleDate(reviewSummary.nextReviewAt)}</strong>
          <small>按间隔重复自动计算</small>
        </div>
      </section>

      <div className="study-plan-grid">
        <section className="study-plan-section">
          <div className="study-plan-section-title">
            <span>今日计划</span>
            <small>{planQuestions.length} 道</small>
          </div>
          {planQuestions.length === 0 ? (
            <Empty description="还没有加入今日计划的题目">
              <Button
                type="primary"
                ghost
                loading={isLoadingSeeds}
                disabled={!canGeneratePlan}
                onClick={handleGeneratePlan}
              >
                自动生成计划
              </Button>
            </Empty>
          ) : (
            <div className="study-question-stack">
              {planQuestions.map(question => {
                const state = getState(question.id)
                return (
                  <article key={question.id} className="study-question-item" onClick={() => navigate(`/question/${question.id}`)}>
                    <div>
                      <h3>{question.title}</h3>
                      <div className="study-question-meta">
                        <span>{question.categoryName}</span>
                        <span className={`difficulty-tag ${question.difficulty.toLowerCase()}`}>
                          {difficultyLabels[question.difficulty] || question.difficulty}
                        </span>
                        <StudyStatusBadge status={state.status} addedToPlan={state.addedToPlan} />
                      </div>
                    </div>
                    <StudyActionButtons
                      compact
                      questionId={question.id}
                      state={state}
                      onPlanChange={setInPlan}
                      onMarkWeak={(id) => setStatus(id, 'weak')}
                      onMarkMastered={(id) => setStatus(id, 'mastered')}
                    />
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="study-plan-section">
          <div className="study-plan-section-title">
            <span>智能复习队列</span>
            <small>{reviewQueue.length} 道</small>
          </div>
          {reviewQueue.length === 0 ? (
            <div className="study-empty-panel">
              <FireOutlined />
              <p>标记薄弱或加入计划后，这里会自动生成复习队列。</p>
            </div>
          ) : (
            <div className="review-queue-list">
              {reviewQueue.map(item => {
                const state = getState(item.id)
                return (
                  <button key={item.id} onClick={() => navigate(`/question/${item.id}`)}>
                    <div>
                      <div className="review-queue-item-top">
                        <span className={`review-due-badge ${item.dueStatus}`}>{dueStatusLabels[item.dueStatus]}</span>
                        <small>{item.categoryName} · 复习 {item.reviewCount} 次</small>
                      </div>
                      <strong>{item.title}</strong>
                      <small>{item.scheduleReason}</small>
                    </div>
                    <ArrowRightOutlined />
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
