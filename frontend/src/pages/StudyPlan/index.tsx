import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, InputNumber, Progress, Segmented, Select } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../../utils/feedbackMessage'
import {
  ArrowRightOutlined,
  BookOutlined,
  CopyOutlined,
  FireOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AbilityMapPanel from '../../components/AbilityMapPanel'
import StudyActionButtons from '../../components/StudyActionButtons'
import InterviewBriefPanel from '../../components/InterviewBriefPanel'
import InterviewMistakeLedgerPanel from '../../components/InterviewMistakeLedgerPanel'
import SprintReportActions from '../../components/SprintReportActions'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import StudyPaceCoachPanel from '../../components/StudyPaceCoachPanel'
import DailyPlanBriefPanel from '../../components/DailyPlanBriefPanel'
import DailyPlanCompletionPanel from '../../components/DailyPlanCompletionPanel'
import NextTrainingQueuePanel from '../../components/NextTrainingQueuePanel'
import PrepHealthRadarPanel from '../../components/PrepHealthRadarPanel'
import InterviewEmergencyKitPanel from '../../components/InterviewEmergencyKitPanel'
import InterviewLastMinuteBriefPanel from '../../components/InterviewLastMinuteBriefPanel'
import InterviewMaterialVaultPanel from '../../components/InterviewMaterialVaultPanel'
import InterviewFollowUpDefensePanel from '../../components/InterviewFollowUpDefensePanel'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { getHotQuestions } from '../../api/question'
import type { Question, ReviewDueStatus, StudyProgress } from '../../types'
import { buildReviewScheduleMarkdown, buildScheduledReviewQueue, summarizeReviewSchedule } from '../../utils/reviewSchedule'
import { buildDailyPlan, getQuestionState, resolvePlanQuestions, summarizeProgress } from '../../utils/studyProgress'
import { buildPaceFilledDailyPlan } from '../../utils/studyPacePlan'
import { buildDailyPracticePath } from '../../utils/practiceRoute'

interface FirstRunCompletionMaterial {
  questionId: number
  title: string
  categoryName: string
  score?: number
  excerpt: string
}

interface FirstRunCompletionReport {
  completedCount: number
  averageScore?: number
  bestScore?: number
  latestCompletedAt?: string
  priorityMaterial: FirstRunCompletionMaterial
  rehearsalQueueIds: number[]
  materials: FirstRunCompletionMaterial[]
}

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
const ACTIVE_RECALL_ENCOUNTER_THRESHOLD = 2
const FIRST_RUN_REHEARSAL_SOURCE = 'first-run-rehearsal'
type StudyCenterView = 'today' | 'ability' | 'review' | 'materials'

const studyCenterViews: { label: string; value: StudyCenterView }[] = [
  { label: '今日训练', value: 'today' },
  { label: '能力分析', value: 'ability' },
  { label: '复盘计划', value: 'review' },
  { label: '面试素材', value: 'materials' },
]

const studyCenterTitles: Record<StudyCenterView, { title: string; summary: string }> = {
  today: { title: '今日训练', summary: '先完成今日队列，再处理到期复习。' },
  ability: { title: '能力分析', summary: '定位岗位短板，决定下一轮训练重点。' },
  review: { title: '复盘计划', summary: '收回薄弱题、复习债和面试风险。' },
  materials: { title: '面试素材', summary: '沉淀高分回答、项目证据和追问口径。' },
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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const dueReviewItems = useMemo(
    () => reviewQueue.filter(item => item.dueStatus !== 'upcoming'),
    [reviewQueue],
  )
  const dueReviewQuestionIds = useMemo(
    () => dueReviewItems.map(item => item.id),
    [dueReviewItems],
  )
  const activeRecallReviewCount = useMemo(
    () => dueReviewItems.filter(item => isActiveRecallReviewState(progress, item.id)).length,
    [dueReviewItems, progress],
  )
  const isActiveRecallOnlyReviewQueue = dueReviewItems.length > 0
    && activeRecallReviewCount === dueReviewItems.length
  const reviewQueueTitle = isActiveRecallOnlyReviewQueue ? '主动回忆优先' : '智能复习队列'
  const reviewQueueMetric = isActiveRecallOnlyReviewQueue
    ? `${activeRecallReviewCount} 道多次遇见题`
    : activeRecallReviewCount > 0 ? `含 ${activeRecallReviewCount} 道主动回忆` : `${reviewQueue.length} 道`
  const dueReviewPracticeLabel = isActiveRecallOnlyReviewQueue ? '练主动回忆' : '练到期复习'
  const firstRunCompletionReport = useMemo(() => buildFirstRunCompletionReport(progress), [progress])
  const trackedCount = Object.keys(progress.questionStates).length
  const canGeneratePlan = generatedPlanIds.length > 0
  const canFillPacePlan = hotQuestions.length > 0 || Object.keys(progress.questionSnapshots).length > 0
  const requestedView = searchParams.get('view')
  const activeView: StudyCenterView = studyCenterViews.some(view => view.value === requestedView)
    ? requestedView as StudyCenterView
    : 'today'
  const activeViewMeta = studyCenterTitles[activeView]

  const changeStudyCenterView = (view: StudyCenterView) => {
    const next = new URLSearchParams(searchParams)
    next.set('view', view)
    setSearchParams(next)
  }

  useEffect(() => {
    let ignore = false

    getHotQuestions(12, { silentGlobalError: true })
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
      emitFeedbackWarning('暂无可补齐的题目，先进入题库添加题目')
      return
    }
    if (nextPlanKey === currentPlanKey) {
      emitFeedbackWarning('暂无可补齐的新增题目，先进入题库补充题源')
      return
    }

    setDailyPlan(nextPlanIds)
    emitFeedbackSuccess(`已按配速补齐到 ${nextPlanIds.length} 道今日计划`)
  }

  const handleCopyReviewSchedule = async () => {
    const markdown = buildReviewScheduleMarkdown(progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('智能复习队列已复制')
      return
    }

    downloadMarkdown(markdown, buildReviewScheduleFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 队列')
  }

  const handleStartDueReviewPractice = () => {
    navigate(buildDailyPracticePath(dueReviewQuestionIds, 12, 'review-due'))
  }

  const handleCopyFirstRunCompletion = async () => {
    if (!firstRunCompletionReport) {
      return
    }
    const markdown = buildFirstRunCompletionMarkdown(firstRunCompletionReport, progress.targetRole)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('首练成果战报已复制')
      return
    }

    downloadMarkdown(markdown, buildFirstRunCompletionFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 战报')
  }

  return (
    <div>
      <div className="study-plan-header">
        <div>
          <div className="dashboard-kicker">学习中心</div>
          <h1>{progress.targetRole} · {activeViewMeta.title}</h1>
          <p>{activeViewMeta.summary} 数据保存在本机。</p>
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
            onClick={() => navigate(buildDailyPracticePath(progress.dailyPlan, 12, 'daily-plan'))}
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

      <div className="study-center-switcher">
        <Segmented<StudyCenterView>
          aria-label="学习中心分区"
          block
          value={activeView}
          options={studyCenterViews}
          onChange={changeStudyCenterView}
        />
      </div>

      {activeView === 'today' && (
        <div className="study-center-view">
          <StudyPaceCoachPanel
            progress={progress}
            canFillPlan={canFillPacePlan}
            isFillingPlan={isLoadingSeeds}
            onFillPlan={handleFillPacePlan}
          />
          <DailyPlanBriefPanel progress={progress} candidates={hotQuestions} />
          <DailyPlanCompletionPanel progress={progress} />
          {firstRunCompletionReport && (
        <section className="first-run-completion-report" aria-label="首练成果沉淀">
          <div className="first-run-completion-head">
            <div>
              <div className="dashboard-kicker">首练战报</div>
              <h2>今日首练已过线</h2>
              <p>
                {firstRunCompletionReport.completedCount} 道首练已过线，先把高分回答沉淀成可复述素材，再决定是否加练下一组高频题。
              </p>
            </div>
            <div className="first-run-completion-actions">
              <Button icon={<CopyOutlined />} onClick={handleCopyFirstRunCompletion}>
                复制首练战报
              </Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(buildDailyPracticePath(
                  firstRunCompletionReport.rehearsalQueueIds,
                  12,
                  FIRST_RUN_REHEARSAL_SOURCE,
                ))}
              >
                抽查复述
              </Button>
            </div>
          </div>
          <div className="first-run-completion-metrics">
            <article>
              <span>完成题数</span>
              <strong>{firstRunCompletionReport.completedCount} 道首练已过线</strong>
              <small>今日计划全部掌握</small>
            </article>
            <article>
              <span>平均表现</span>
              <strong>{firstRunCompletionReport.averageScore === undefined ? '暂无评分' : `平均 ${firstRunCompletionReport.averageScore} 分`}</strong>
              <small>来自首练模拟评分</small>
            </article>
            <article>
              <span>最高分</span>
              <strong>{firstRunCompletionReport.bestScore === undefined ? '暂无' : `${firstRunCompletionReport.bestScore} 分`}</strong>
              <small>{formatCompletionTime(firstRunCompletionReport.latestCompletedAt)}</small>
            </article>
          </div>
          <div className="first-run-completion-priority" aria-label="首练复述优先题">
            <div>
              <span>复述优先题</span>
              <strong>{firstRunCompletionReport.priorityMaterial.title}</strong>
              <p>先复述分数最低的已过线答案，确认结论、项目证据和风险边界都能脱稿说清。</p>
            </div>
            <div className="first-run-completion-priority-action">
              <em>
                {firstRunCompletionReport.priorityMaterial.categoryName}
                {firstRunCompletionReport.priorityMaterial.score === undefined ? '' : ` · ${firstRunCompletionReport.priorityMaterial.score} 分`}
              </em>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(buildDailyPracticePath(
                  firstRunCompletionReport.rehearsalQueueIds,
                  12,
                  FIRST_RUN_REHEARSAL_SOURCE,
                ))}
              >
                优先复述
              </Button>
            </div>
          </div>
          <div className="first-run-completion-materials">
            {firstRunCompletionReport.materials.map(material => (
              <button key={material.questionId} type="button" onClick={() => navigate(`/question/${material.questionId}`)}>
                <div>
                  <div className="first-run-completion-material-top">
                    <strong>{material.title}</strong>
                    <em>{material.categoryName}{material.score === undefined ? '' : ` · ${material.score} 分`}</em>
                  </div>
                  <p>{material.excerpt}</p>
                  <small>回看首练素材</small>
                </div>
                <ArrowRightOutlined />
              </button>
            ))}
          </div>
        </section>
          )}
        </div>
      )}

      {activeView === 'ability' && (
        <div className="study-center-view">
          <PrepHealthRadarPanel />
          <AbilityMapPanel />
          <NextTrainingQueuePanel progress={progress} />
        </div>
      )}

      {activeView === 'review' && (
        <div className="study-center-view">
          <InterviewEmergencyKitPanel progress={progress} />
          <InterviewLastMinuteBriefPanel progress={progress} />
          <InterviewBriefPanel progress={progress} />
          <InterviewMistakeLedgerPanel progress={progress} />
        </div>
      )}

      {activeView === 'materials' && (
        <div className="study-center-view">
          <InterviewMaterialVaultPanel progress={progress} onNavigate={navigate} />
          <InterviewFollowUpDefensePanel progress={progress} onNavigate={navigate} />
        </div>
      )}

      {activeView === 'today' && (
        <div className="study-center-view">
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
        <div className="active-recall">
          <span>主动回忆</span>
          <strong>{reviewSummary.activeRecall}</strong>
          <small>多次遇见题</small>
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
                  <article
                    key={question.id}
                    className="study-question-item"
                    tabIndex={0}
                    onClick={() => navigate(`/question/${question.id}`)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || event.key !== 'Enter') {
                        return
                      }
                      navigate(`/question/${question.id}`)
                    }}
                  >
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

        <section className="study-plan-section" aria-label="智能复习队列">
          <div className="study-plan-section-title with-actions">
            <div>
              <span>{reviewQueueTitle}</span>
              <small>{reviewQueueMetric}</small>
            </div>
            <div className="study-plan-section-actions">
              {dueReviewQuestionIds.length > 0 && (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartDueReviewPractice}
                >
                  {dueReviewPracticeLabel}
                </Button>
              )}
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReviewSchedule}>
                复制队列
              </Button>
            </div>
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
                const isActiveRecallItem = isActiveRecallReviewState(progress, item.id)
                return (
                  <button type="button" key={item.id} onClick={() => navigate(`/question/${item.id}`)}>
                    <div>
                      <div className="review-queue-item-top">
                        <span className={`review-due-badge ${isActiveRecallItem ? 'active-recall' : item.dueStatus}`}>
                          {isActiveRecallItem ? '主动回忆' : dueStatusLabels[item.dueStatus]}
                        </span>
                        <small>
                          {item.categoryName} · {isActiveRecallItem
                            ? `遇见 ${state.encounterCount ?? ACTIVE_RECALL_ENCOUNTER_THRESHOLD} 次`
                            : `复习 ${item.reviewCount} 次`}
                        </small>
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
      )}
    </div>
  )
}

function isActiveRecallReviewState(progress: StudyProgress, questionId: number): boolean {
  const state = progress.questionStates[questionId]
  return state?.status === 'new'
    && state.reviewCount === 0
    && (state.encounterCount ?? 0) >= ACTIVE_RECALL_ENCOUNTER_THRESHOLD
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

function buildReviewScheduleFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-智能复习队列.md`
}

function buildFirstRunCompletionFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-首练成果战报.md`
}

function buildFirstRunCompletionMarkdown(report: FirstRunCompletionReport, targetRole: string): string {
  const rehearsalPracticePath = buildDailyPracticePath(
    report.rehearsalQueueIds,
    12,
    FIRST_RUN_REHEARSAL_SOURCE,
  )

  return [
    `# ${targetRole} 首练成果战报`,
    '',
    '## 概览',
    `- 完成题数：${report.completedCount}`,
    `- 平均分：${report.averageScore === undefined ? '暂无评分' : report.averageScore}`,
    `- 最高分：${report.bestScore === undefined ? '暂无' : report.bestScore}`,
    `- 最近完成：${formatCompletionTime(report.latestCompletedAt)}`,
    '',
    '## 复述优先题',
    `- 题目：${report.priorityMaterial.title}`,
    `- 分类：${report.priorityMaterial.categoryName}`,
    `- 分数：${report.priorityMaterial.score === undefined ? '暂无评分' : report.priorityMaterial.score}`,
    '- 原因：全队列中分数最低的已过线答案，最适合先做脱稿抽查。',
    `- 入口：/question/${report.priorityMaterial.questionId}`,
    '',
    '## 可复述素材',
    ...report.materials.flatMap(material => [
      `### ${material.title}`,
      `- 分类：${material.categoryName}`,
      `- 分数：${material.score === undefined ? '暂无评分' : material.score}`,
      `- 回答片段：${material.excerpt}`,
      `- 入口：/question/${material.questionId}`,
      '',
    ]),
    '## 下一步',
    '- 抽查复述：从复述优先题开始，按低分到高分完成脱稿验证。',
    `- 复述入口：${rehearsalPracticePath}`,
    '- 素材复用：把高分回答片段整理进简历项目或面试自我介绍。',
  ].join('\n')
}

function buildFirstRunCompletionReport(progress: StudyProgress): FirstRunCompletionReport | null {
  const planIds = [...new Set(progress.dailyPlan.filter(id => Number.isFinite(id) && id > 0))]
  if (planIds.length === 0) {
    return null
  }
  const allMastered = planIds.every(questionId => getQuestionState(progress, questionId).status === 'mastered')
  if (!allMastered) {
    return null
  }

  const materials = planIds.map(questionId => {
    const snapshot = progress.questionSnapshots[questionId]
    const latestAttempt = latestAttemptForQuestion(progress, questionId)
    return {
      questionId,
      title: snapshot?.title ?? `题目 #${questionId}`,
      categoryName: snapshot?.categoryName ?? '未分组',
      score: latestAttempt?.feedback.score,
      excerpt: latestAttempt ? buildAnswerExcerpt(latestAttempt.answer) : '这道题已标记掌握，建议回看题目补一段可复述项目证据。',
    }
  })
  const rehearsalMaterials = [...materials].sort((left, right) => {
    const scoreDiff = scoreForRehearsalPriority(left.score) - scoreForRehearsalPriority(right.score)
    if (scoreDiff !== 0) {
      return scoreDiff
    }
    return planIds.indexOf(left.questionId) - planIds.indexOf(right.questionId)
  })
  const scores = materials
    .map(material => material.score)
    .filter((score): score is number => typeof score === 'number')
  const latestCompletedAt = planIds
    .map(questionId => getQuestionState(progress, questionId).lastReviewedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0]

  return {
    completedCount: planIds.length,
    averageScore: scores.length === 0 ? undefined : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    bestScore: scores.length === 0 ? undefined : Math.max(...scores),
    latestCompletedAt,
    priorityMaterial: rehearsalMaterials[0],
    rehearsalQueueIds: rehearsalMaterials.map(material => material.questionId),
    materials: rehearsalMaterials.slice(0, 3),
  }
}

function scoreForRehearsalPriority(score?: number): number {
  return score === undefined ? Number.POSITIVE_INFINITY : score
}

function latestAttemptForQuestion(
  progress: StudyProgress,
  questionId: number,
) {
  return [...(progress.interviewAttempts[questionId] ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
}

function buildAnswerExcerpt(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 78) {
    return normalized
  }
  return `${normalized.slice(0, 78)}...`
}

function formatCompletionTime(value?: string): string {
  if (!value) {
    return '等待模拟评分沉淀'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '等待模拟评分沉淀'
  }
  return `最近完成 ${date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}`
}
