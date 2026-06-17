import { useEffect, useState } from 'react'
import { Alert } from 'antd'
import CategoryGrid from './CategoryGrid'
import HotQuestions from './HotQuestions'
import StudyDashboard from '../../components/StudyDashboard'
import { getHotQuestions } from '../../api/question'
import { freePromiseItems } from '../../data/freeSuperiority'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import type { Question } from '../../types'

export default function Home() {
  const [hotQuestions, setHotQuestions] = useState<Question[]>([])
  const [hotLoading, setHotLoading] = useState(true)
  const [hotError, setHotError] = useState(false)
  const { rememberQuestions } = useStudyProgress()

  const fetchHotQuestions = () => {
    setHotLoading(true)
    setHotError(false)
    getHotQuestions(10)
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
      <StudyDashboard hotQuestions={hotQuestions} />

      <section className="free-promise-band" aria-label="免费承诺">
        {freePromiseItems.map(item => (
          <div key={item.title}>
            <strong>{item.metric}</strong>
            <span>{item.title}</span>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <div>
            <h2 className="section-title">题库入口</h2>
            <p className="section-subtitle">按技术方向进入系统刷题，先建立知识面，再补重点短板。</p>
          </div>
          <span>46 个方向</span>
        </div>
        <CategoryGrid />
      </section>

      <section className="home-section home-hot-section">
        <div className="home-section-header">
          <div>
            <h2 className="section-title">热门题目排行</h2>
            <p className="section-subtitle">优先挑高频题加入今日计划。</p>
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
          questions={hotQuestions}
          loading={hotLoading}
          error={hotError}
          onRetry={fetchHotQuestions}
        />
      </section>
    </div>
  )
}
