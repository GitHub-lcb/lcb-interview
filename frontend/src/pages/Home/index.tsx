import { useEffect, useMemo, useState } from 'react'
import { Alert } from 'antd'
import CategoryGrid from './CategoryGrid'
import HotQuestions from './HotQuestions'
import FirstRunLaunchpad from '../../components/FirstRunLaunchpad'
import HomeCoachOverview from '../../components/HomeCoachOverview'
import { getHotQuestions } from '../../api/question'
import { buildHomeCoach } from '../../utils/homeCoach'
import { readPracticeAnswerDrafts } from '../../utils/practiceAnswerDraftStore'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import type { Question } from '../../types'

export default function Home() {
  const [hotQuestions, setHotQuestions] = useState<Question[]>([])
  const [hotLoading, setHotLoading] = useState(true)
  const [hotError, setHotError] = useState(false)
  const { progress, rememberQuestions } = useStudyProgress()
  const answerDrafts = useMemo(() => readPracticeAnswerDrafts(), [])
  const coachModel = useMemo(
    () => buildHomeCoach(progress, hotQuestions, { answerDrafts, loading: hotLoading }),
    [answerDrafts, hotLoading, hotQuestions, progress],
  )

  const fetchHotQuestions = () => {
    setHotLoading(true)
    setHotError(false)
    getHotQuestions(20, { silentGlobalError: true })
      .then(data => {
        setHotQuestions(data)
        rememberQuestions(data)
        setHotLoading(false)
      })
      .catch(() => {
        setHotError(true)
        setHotLoading(false)
      })
  }

  useEffect(() => {
    fetchHotQuestions()
  }, [])

  return (
    <div className="home-page">
      <FirstRunLaunchpad
        hotQuestions={hotQuestions}
        loading={hotLoading}
        launchpadModel={coachModel.launchpad}
      />

      <HomeCoachOverview model={coachModel} candidates={hotQuestions} />

      <section className="home-section">
        <div className="home-section-header">
          <div>
            <h2 className="section-title">题库入口</h2>
            <p className="section-subtitle">按目标岗位筛选核心方向，需要时再进入完整题库。</p>
          </div>
          <span>46 个技术方向</span>
        </div>
        <CategoryGrid />
      </section>

      <section className="home-section home-hot-section">
        <div className="home-section-header">
          <div>
            <h2 className="section-title">热门题目</h2>
            <p className="section-subtitle">看看其他面试者正在关注什么。</p>
          </div>
          <span>高频优先</span>
        </div>
        {hotError && (
          <Alert
            type="warning"
            showIcon
            message="热门题目加载失败，题库入口仍可使用。"
            className="home-alert"
          />
        )}
        <HotQuestions
          questions={hotQuestions.slice(0, 5)}
          loading={hotLoading}
          error={hotError}
          onRetry={fetchHotQuestions}
        />
      </section>
    </div>
  )
}
