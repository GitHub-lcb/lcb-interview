import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  FireOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
} from '@ant-design/icons'
import { Button, Progress } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import type { Question } from '../types'
import type { HomeCoachModel } from '../utils/homeCoach'
import { buildDailyPracticePath } from '../utils/practiceRoute'
import { useStudyProgress } from '../hooks/useStudyProgress'

interface Props {
  model: HomeCoachModel
  candidates: Question[]
}

const statusLabels = {
  new: '待摸底',
  learning: '巩固中',
  weak: '优先补弱',
  mastered: '已掌握',
}

export default function HomeCoachOverview({ model, candidates }: Props) {
  const navigate = useNavigate()
  const { addDailyPlanQuestions, rememberQuestions } = useStudyProgress()

  const startQueue = (questionIds: number[], source: string) => {
    if (questionIds.length === 0) {
      navigate('/banks')
      return
    }
    const idSet = new Set(questionIds)
    rememberQuestions(candidates.filter(question => idSet.has(question.id)))
    addDailyPlanQuestions(questionIds)
    navigate(buildDailyPracticePath(questionIds, 12, source))
  }

  return (
    <>
      <section className="home-coach-overview" aria-label="今日训练与能力画像">
        <div className="home-today-panel">
          <div className="home-coach-panel-head">
            <div>
              <span className="home-coach-eyebrow"><PlayCircleOutlined /> 今日行动</span>
              <h2>{model.launchpad.title}</h2>
            </div>
            <Button type="link" onClick={() => navigate('/study?view=today')}>
              完整计划 <ArrowRightOutlined />
            </Button>
          </div>

          <div className="home-today-progress">
            <Progress percent={model.focusProgress} showInfo={false} strokeColor="#2563EB" />
            <span>{model.focusCompleted} / {model.focusQuestions.length || 0} 已评分</span>
          </div>

          {model.focusQuestions.length > 0 ? (
            <div className="home-focus-list">
              {model.focusQuestions.slice(0, 5).map((question, index) => (
                <Link key={question.id} to={`/question/${question.id}`}>
                  <em>{index + 1}</em>
                  <div>
                    <strong>{question.title}</strong>
                    <small>{question.categoryName} · {question.difficulty}</small>
                  </div>
                  <span className={`status-${question.status}`}>
                    {question.score === undefined ? statusLabels[question.status] : `${question.score} 分`}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-coach-empty">
              <CompassOutlined />
              <div>
                <strong>当前没有待处理题目</strong>
                <span>从岗位路线或题库建立下一组训练。</span>
              </div>
            </div>
          )}
        </div>

        <div className="home-ability-summary">
          <div className="home-coach-panel-head">
            <div>
              <span className="home-coach-eyebrow"><RadarChartOutlined /> 能力画像</span>
              <h2>{model.assessedCount > 0 ? '当前面试准备度' : '等待首轮摸底'}</h2>
            </div>
            <Button type="link" onClick={() => navigate('/study?view=ability')}>
              深入分析 <ArrowRightOutlined />
            </Button>
          </div>

          <div className={`home-readiness-score phase-${model.phase}`}>
            <strong>{model.readinessScore}</strong>
            <div>
              <span>准备度</span>
              <small>{model.assessedCount > 0
                ? `已评分 ${model.assessedCount} 题${model.averageScore === undefined ? '' : ` · 平均 ${model.averageScore} 分`}`
                : '完成岗位摸底后生成'}</small>
            </div>
          </div>

          {model.weakAreas.length > 0 ? (
            <div className="home-weak-area-list">
              {model.weakAreas.map((area, index) => (
                <button
                  key={area.categoryName}
                  type="button"
                  onClick={() => startQueue(area.questionIds, 'ability-gap')}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{area.categoryName}</strong>
                    <small>{area.questionCount} 道待补强{area.averageScore === undefined ? '' : ` · 平均 ${area.averageScore} 分`}</small>
                  </div>
                  <ArrowRightOutlined />
                </button>
              ))}
            </div>
          ) : (
            <div className="home-ability-empty">
              <CheckCircleOutlined />
              <div>
                <strong>{model.assessedCount > 0 ? '暂未发现明显短板' : '能力画像尚未建立'}</strong>
                <span>{model.assessedCount > 0 ? '继续训练会逐步校准推荐。' : '首轮评分会定位优先补强方向。'}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="home-recommendation-section" aria-label="为你推荐">
        <div className="home-section-header">
          <div>
            <span className="home-coach-eyebrow"><FireOutlined /> 为你推荐</span>
            <h2 className="section-title">下一组值得练的题</h2>
            <p className="section-subtitle">优先结合目标岗位、薄弱状态和题目热度。</p>
          </div>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={model.recommendations.length === 0}
            onClick={() => startQueue(model.recommendations.map(question => question.id), 'next-training')}
          >
            训练这组题
          </Button>
        </div>

        <div className="home-recommendation-list">
          {model.recommendations.map(question => (
            <Link key={question.id} to={`/question/${question.id}`}>
              <div>
                <span>{question.categoryName}</span>
                <strong>{question.title}</strong>
              </div>
              <em className={`status-${question.status}`}>{statusLabels[question.status]}</em>
              <ArrowRightOutlined />
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
