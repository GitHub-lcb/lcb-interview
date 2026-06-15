import { Button, Progress } from 'antd'
import {
  CalendarOutlined,
  FireOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RadarChartOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question } from '../types'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { resolvePlanQuestions, summarizeProgress, weakAreasFromQuestions } from '../utils/studyProgress'

interface Props {
  hotQuestions: Question[]
}

export default function StudyDashboard({ hotQuestions }: Props) {
  const navigate = useNavigate()
  const { progress, setInPlan } = useStudyProgress()
  const summary = summarizeProgress(progress)
  const planQuestions = useMemo(() => resolvePlanQuestions(progress, hotQuestions, 5), [hotQuestions, progress])
  const weakAreas = useMemo(() => weakAreasFromQuestions(progress, hotQuestions), [hotQuestions, progress])
  const planCount = progress.dailyPlan.length
  const nextQuestion = planQuestions[0] ?? hotQuestions[0]

  return (
    <section className="study-dashboard">
      <div className="study-dashboard-top">
        <div className="study-hero">
          <div className="dashboard-kicker">备考工作台</div>
          <h1>{progress.targetRole} · {progress.sprintDays} 天冲刺</h1>
          <p>今天只做最值得做的题：先补薄弱点，再巩固高频题。</p>
          <div className="study-hero-actions">
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/practice')}>
              开始训练
            </Button>
            <Button icon={<CalendarOutlined />} onClick={() => navigate('/study')}>
              打开学习计划
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
              <small>{planQuestions.length > 0 ? '按优先级执行' : '从热门题开始建立计划'}</small>
            </div>
            {nextQuestion && (
              <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />} onClick={() => navigate('/practice')}>
                进入训练
              </Button>
            )}
          </div>
          {planQuestions.length === 0 ? (
            <p className="dashboard-empty">先浏览题目并标记薄弱或加入计划，系统会开始推荐。</p>
          ) : (
            <div className="daily-plan-list">
              {planQuestions.map((q, index) => (
                <button key={q.id} onClick={() => navigate(`/question/${q.id}`)}>
                  <span>{index + 1}</span>
                  <div className="daily-plan-content">
                    <b>{q.title}</b>
                    <small>{q.categoryName} · {q.difficulty}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
          {hotQuestions[0] && (
            <Button icon={<PlusOutlined />} onClick={() => setInPlan(hotQuestions[0].id, true)} size="small">
              把热门第一题加入计划
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
