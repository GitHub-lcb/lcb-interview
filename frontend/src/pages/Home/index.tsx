import { useEffect, useMemo, useState } from 'react'
import { Alert } from 'antd'
import LabHero from './LabHero'
import CategoryWorkspace from './CategoryWorkspace'
import HotQuestions from './HotQuestions'
import FirstRunLaunchpad from '../../components/FirstRunLaunchpad'
import HomeCoachOverview from '../../components/HomeCoachOverview'
import { getCategories } from '../../api/category'
import { getHotQuestions, getQuestions } from '../../api/question'
import { buildHomeCoach } from '../../utils/homeCoach'
import { readPracticeAnswerDrafts } from '../../utils/practiceAnswerDraftStore'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import type { Category, Question } from '../../types'

export default function Home() {
  const [hotQuestions, setHotQuestions] = useState<Question[]>([])
  const [hotLoading, setHotLoading] = useState(true)
  const [hotError, setHotError] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState(false)
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null)
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

  const fetchCategories = () => {
    setCategoriesLoading(true)
    setCategoriesError(false)
    getCategories({ silentGlobalError: true })
      .then(data => {
        setCategories(data)
        setCategoriesLoading(false)
      })
      .catch(() => {
        setCategoriesError(true)
        setCategoriesLoading(false)
      })
  }

  useEffect(() => {
    fetchHotQuestions()
    fetchCategories()
  }, [])

  // 题目总数只取分页接口的 total（size=1 几乎无传输成本），失败时 Hero 显示占位符。
  useEffect(() => {
    getQuestions({ size: 1 }, { silentGlobalError: true })
      .then(page => setTotalQuestions(page.total))
      .catch(() => setTotalQuestions(null))
  }, [])

  return (
    <div className="home-page">
      <LabHero categoryCount={categories.length} totalQuestions={totalQuestions} />

      <section className="home-section">
        <div className="home-section-header">
          <div>
            <h2 className="section-title">题库实验室</h2>
            <p className="section-subtitle">按中文数字编号切换模块，选中题目即可在右侧预览。</p>
          </div>
          <span>选中即练</span>
        </div>
        <CategoryWorkspace
          categories={categories}
          loading={categoriesLoading}
          error={categoriesError}
          onRetry={fetchCategories}
        />
      </section>

      <FirstRunLaunchpad
        hotQuestions={hotQuestions}
        loading={hotLoading}
        launchpadModel={coachModel.launchpad}
      />

      <HomeCoachOverview model={coachModel} candidates={hotQuestions} />

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
