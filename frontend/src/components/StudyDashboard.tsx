import { Button, Progress } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import {
  CalendarOutlined,
  CopyOutlined,
  FireOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question } from '../types'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildDailyPlan, resolvePlanQuestions, summarizeProgress, weakAreasFromQuestions } from '../utils/studyProgress'
import { buildStudyDashboardMarkdown } from '../utils/studyDashboardReport'
import { buildDailyPracticePath } from '../utils/practiceRoute'

interface Props {
  hotQuestions: Question[]
}

export default function StudyDashboard({ hotQuestions }: Props) {
  const navigate = useNavigate()
  const { getState, progress, rememberQuestions, setDailyPlan } = useStudyProgress()
  const summary = summarizeProgress(progress)
  const generatedPlanIds = useMemo(
    () => buildDailyPlan(progress, hotQuestions, Math.max(progress.dailyPlan.length, 5)),
    [hotQuestions, progress],
  )
  const planQuestions = useMemo(() => resolvePlanQuestions(progress, hotQuestions, 5), [hotQuestions, progress])
  const weakAreas = useMemo(() => weakAreasFromQuestions(progress, hotQuestions), [hotQuestions, progress])
  const planCount = progress.dailyPlan.length
  const nextQuestion = planQuestions[0] ?? hotQuestions[0]
  const canGeneratePlan = generatedPlanIds.length > 0
  const planActionText = planCount > 0 ? '补齐今日计划' : '生成今日计划'
  const trainingQuestionIds = planCount > 0 ? progress.dailyPlan : generatedPlanIds
  const trainingPath = buildDailyPracticePath(trainingQuestionIds, 12, 'daily-plan')

  const handleGeneratePlan = () => {
    if (!canGeneratePlan) {
      return
    }
    rememberRecommendedQuestions(generatedPlanIds)
    setDailyPlan(generatedPlanIds)
  }

  const handleStartTraining = () => {
    rememberRecommendedQuestions(trainingQuestionIds)
    if (planCount === 0 && generatedPlanIds.length > 0) {
      setDailyPlan(generatedPlanIds)
    }
    navigate(trainingPath)
  }

  const rememberRecommendedQuestions = (questionIds: number[]) => {
    if (questionIds.length === 0) {
      return
    }
    const questionIdSet = new Set(questionIds)
    rememberQuestions(hotQuestions.filter(question => questionIdSet.has(question.id)))
  }

  const handleCopyDashboard = async () => {
    const markdown = buildStudyDashboardMarkdown(progress, hotQuestions)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('备考工作台日报已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 工作台日报')
  }

  return (
    <section className="study-dashboard">
      <div className="study-dashboard-top">
        <div className="study-hero">
          <div className="dashboard-kicker">备考工作台</div>
          <h1>{progress.targetRole} · {progress.sprintDays} 天冲刺</h1>
          <p>今天只做最值得做的题：先补薄弱点，再巩固高频题。</p>
          <div className="study-hero-actions">
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartTraining}>
              开始训练
            </Button>
            <Button icon={<CalendarOutlined />} onClick={() => navigate('/study')}>
              打开学习计划
            </Button>
            <Button icon={<CopyOutlined />} onClick={handleCopyDashboard}>
              复制日报
            </Button>
            <Button icon={<ThunderboltOutlined />} disabled={!canGeneratePlan} onClick={handleGeneratePlan}>
              {planActionText}
            </Button>
          </div>
          <div className="study-hero-metrics" aria-label="学习状态摘要">
            <div>
              <span>今日计划</span>
              <strong>{planCount}</strong>
            </div>
            <div>
              <span>薄弱题</span>
              <strong>{summary.weak}</strong>
            </div>
            <div>
              <span>跟踪题</span>
              <strong>{summary.totalTracked}</strong>
            </div>
          </div>
        </div>
        <div className="mastery-card">
          <div className="mastery-card-title">
            <span>掌握度</span>
            <RadarChartOutlined />
          </div>
          <strong>{summary.masteryRate}%</strong>
          <Progress percent={summary.masteryRate} showInfo={false} strokeColor="#059669" />
          <small>{summary.learning} 道学习中 · {summary.mastered} 道已掌握</small>
        </div>
      </div>

      <div className="study-dashboard-grid">
        <div className="dashboard-card dashboard-card-primary">
          <div className="dashboard-card-title-row">
            <div>
              <span className="dashboard-card-title">今日计划</span>
              <small>{planCount > 0 ? `${planCount} 道已加入` : `${planQuestions.length} 道推荐`}</small>
            </div>
            {nextQuestion && (
              <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />} onClick={handleStartTraining}>
                进入训练
              </Button>
            )}
          </div>
          {planQuestions.length === 0 ? (
            <p className="dashboard-empty">先浏览题目并标记薄弱或加入计划，系统会开始推荐。</p>
          ) : (
            <div className="daily-plan-list">
              {planQuestions.map((q, index) => {
                const state = getState(q.id)
                const isPlanned = state.addedToPlan || progress.dailyPlan.includes(q.id)
                return (
                  <button type="button" key={q.id} onClick={() => navigate(`/question/${q.id}`)}>
                    <span>{index + 1}</span>
                    <div className="daily-plan-content">
                      <b>{q.title}</b>
                      <small>{q.categoryName} · {q.difficulty}</small>
                    </div>
                    <em className={isPlanned ? 'planned' : 'suggested'}>{isPlanned ? '计划内' : '推荐'}</em>
                  </button>
                )
              })}
            </div>
          )}
          {planQuestions.length > 0 && (
            <Button icon={<ThunderboltOutlined />} onClick={handleGeneratePlan} disabled={!canGeneratePlan} size="small">
              {planActionText}
            </Button>
          )}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title-row">
            <div>
              <span className="dashboard-card-title">弱点雷达</span>
              <small>按分类聚合短板</small>
            </div>
            <FireOutlined className="dashboard-card-icon" />
          </div>
          {weakAreas.length === 0 ? (
            <p className="dashboard-empty">标记薄弱题后，这里会按分类显示短板。</p>
          ) : (
            <div className="weak-area-list">
              {weakAreas.map(area => (
                <div key={area.categoryName}>
                  <div>
                    <span>{area.categoryName}</span>
                    <strong>{area.score}</strong>
                  </div>
                  <Progress percent={Math.min(100, area.score * 20)} showInfo={false} strokeColor="#DC2626" />
                </div>
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
  return `${safeRole || '岗位'}-备考工作台日报.md`
}
