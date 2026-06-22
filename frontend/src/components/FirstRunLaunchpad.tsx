import { Button } from 'antd'
import {
  CalendarOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question } from '../types'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildFirstRunLaunchpad } from '../utils/firstRunLaunchpad'
import { buildContinuePracticePath } from '../utils/practiceRoute'
import { readPracticeAnswerDrafts } from '../utils/practiceAnswerDraftStore'

interface Props {
  hotQuestions: Question[]
  loading?: boolean
}

const roleOptions = ['Java 后端', '前端工程师', 'AI 大模型', '系统架构师']

export default function FirstRunLaunchpad({ hotQuestions, loading = false }: Props) {
  const navigate = useNavigate()
  const { addDailyPlanQuestions, progress, rememberQuestions, setDailyPlan, updateSettings } = useStudyProgress()
  const answerDrafts = useMemo(() => readPracticeAnswerDrafts(), [])
  const model = useMemo(
    () => buildFirstRunLaunchpad(progress, hotQuestions, { answerDrafts, loading }),
    [answerDrafts, hotQuestions, loading, progress],
  )
  const primaryDisabled = model.mode === 'loading'
    || (model.primaryAction.kind === 'plan' && model.recommendedQuestionIds.length === 0)

  const runPrimaryAction = () => {
    persistRecommendedQuestionSnapshots()
    if (model.primaryAction.kind === 'plan' && model.recommendedQuestionIds.length > 0) {
      setDailyPlan(model.recommendedQuestionIds)
    }
    if (model.primaryAction.kind === 'append-plan' && model.recommendedQuestionIds.length > 0) {
      addDailyPlanQuestions(model.recommendedQuestionIds)
    }
    navigate(model.primaryAction.to)
  }

  const persistRecommendedQuestionSnapshots = () => {
    if (model.recommendedQuestionIds.length === 0) {
      return
    }
    const recommendedIds = new Set(model.recommendedQuestionIds)
    rememberQuestions(hotQuestions.filter(question => recommendedIds.has(question.id)))
  }

  return (
    <section className={`first-run-launchpad mode-${model.mode}`} aria-label="3 分钟首练启动台">
      <div className="first-run-copy">
        <div className="dashboard-kicker">3 分钟首练</div>
        <h1>{model.title}</h1>
        <p>{model.summary}</p>
        <div className="first-run-role-row" aria-label="目标岗位">
          {roleOptions.map(role => (
            <button
              key={role}
              type="button"
              className={progress.targetRole === role ? 'active' : ''}
              onClick={() => updateSettings({ targetRole: role })}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="first-run-action-panel">
        <div className="first-run-metrics">
          {model.metrics.map(metric => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <Button
          type="primary"
          aria-label={model.primaryAction.label}
          icon={<ThunderboltOutlined />}
          loading={model.mode === 'loading'}
          disabled={primaryDisabled}
          onClick={runPrimaryAction}
        >
          {model.primaryAction.label}
        </Button>
        {model.previewItems.length > 0 && (
          <div className="first-run-preview" aria-label="本轮题单预览">
            <span>本轮题单预览</span>
            {model.previewItems.map((item, index) => (
              <div key={item.id}>
                <em>{index + 1}</em>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="first-run-secondary-actions">
          {model.secondaryActions.map(action => (
            <Button
              key={action.to}
              aria-label={action.label}
              icon={action.kind === 'route' ? <ReadOutlined /> : <CalendarOutlined />}
              onClick={() => navigate(action.to)}
            >
              {action.label}
            </Button>
          ))}
          <Button
            aria-label="直接模拟"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(buildContinuePracticePath(progress))}
          >
            直接模拟
          </Button>
        </div>
      </div>
    </section>
  )
}
