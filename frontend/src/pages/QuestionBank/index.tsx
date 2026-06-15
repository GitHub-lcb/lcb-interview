import { useEffect, useMemo, useState } from 'react'
import { Row, Col, Skeleton, Empty, Alert, Button, Segmented } from 'antd'
import { ArrowRightOutlined, CalendarOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/category'
import { getCategoryIcon } from '../../utils/categoryIcons'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { summarizeProgress } from '../../utils/studyProgress'
import type { Category } from '../../types'

const trackFilters = [
  { label: '全部', value: 'ALL' },
  { label: '后端', value: 'BACKEND' },
  { label: '前端', value: 'FRONTEND' },
  { label: 'AI', value: 'AI' },
  { label: '运维', value: 'OPS' },
  { label: '语言', value: 'LANGUAGE' },
]

function resolveTrack(category: Category): string {
  const text = `${category.name} ${category.description}`.toLowerCase()
  if (/ai|大模型|智能体|rag|prompt/.test(text)) {
    return 'AI'
  }
  if (/前端|javascript|typescript|vue|react|html|css|webpack/.test(text)) {
    return 'FRONTEND'
  }
  if (/运维|devops|docker|k8s|nginx|linux|git/.test(text)) {
    return 'OPS'
  }
  if (/go|python|c\+\+|c#|php/.test(text)) {
    return 'LANGUAGE'
  }
  return 'BACKEND'
}

export default function QuestionBank() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [trackFilter, setTrackFilter] = useState<string>('ALL')
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const summary = summarizeProgress(progress)

  const fetch = () => {
    setLoading(true)
    setError(false)
    getCategories().then(data => {
      setCategories(data)
      setLoading(false)
    }).catch(() => {
      setError(true)
      setLoading(false)
    })
  }

  useEffect(() => {
    fetch()
  }, [])

  const visibleCategories = useMemo(() => {
    if (trackFilter === 'ALL') {
      return categories
    }
    return categories.filter(category => resolveTrack(category) === trackFilter)
  }, [categories, trackFilter])

  const trackedByCategory = useMemo(() => {
    return Object.values(progress.questionSnapshots).reduce<Record<string, number>>((acc, snapshot) => {
      acc[snapshot.categoryName] = (acc[snapshot.categoryName] ?? 0) + 1
      return acc
    }, {})
  }, [progress.questionSnapshots])

  if (loading) {
    return (
      <div className="bank-page">
        <div className="bank-hero">
          <div>
            <div className="dashboard-kicker">题库导航</div>
            <h1>全部题库</h1>
            <p>按技术方向选择训练路径，先进入分类，再把高频题加入计划。</p>
          </div>
        </div>
        <Row gutter={[14, 14]} className="category-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <Col xs={24} sm={12} md={8} key={index}>
            <div className="category-card category-card-skeleton">
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          </Col>
        ))}
        </Row>
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="分类加载失败"
        showIcon
        action={<Button onClick={fetch} size="small">重试</Button>}
      />
    )
  }

  if (categories.length === 0) {
    return <Empty description="暂无分类" />
  }

  return (
      <div className="bank-page">
        <div className="bank-hero">
          <div>
            <div className="dashboard-kicker">题库导航</div>
            <h1>全部题库</h1>
            <p>按岗位方向快速定位题库，优先处理已跟踪和今日计划里的题。</p>
            <div className="bank-hero-actions">
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/practice')}>
                继续训练
              </Button>
              <Button icon={<CalendarOutlined />} onClick={() => navigate('/study')}>
                学习计划
              </Button>
            </div>
          </div>
          <div className="bank-hero-stats">
            <div>
              <span>方向数</span>
              <strong>{categories.length}</strong>
              <small>覆盖主流岗位</small>
            </div>
            <div>
              <span>今日计划</span>
              <strong>{progress.dailyPlan.length}</strong>
              <small>待训练题</small>
            </div>
            <div>
              <span>跟踪题</span>
              <strong>{summary.totalTracked}</strong>
              <small>本地进度</small>
            </div>
          </div>
        </div>

      <div className="bank-toolbar">
        <div>
          <span className="dashboard-kicker">专项筛选</span>
          <strong>{visibleCategories.length} 个方向</strong>
        </div>
        <Segmented
          value={trackFilter}
          onChange={value => setTrackFilter(String(value))}
          options={trackFilters}
        />
      </div>

      <Row gutter={[14, 14]} className="category-grid">
        {visibleCategories.map((cat, index) => {
          const track = resolveTrack(cat)
          const trackedCount = trackedByCategory[cat.name] ?? 0
          return (
          <Col xs={24} sm={12} md={8} key={cat.id}>
            <button
              type="button"
              className={`category-card fade-in-up stagger-${(index % 6) + 1}`}
              onClick={() => navigate(`/bank/${cat.id}`)}
            >
              <div className="category-card-main">
                <div className="category-card-icon">
                  {getCategoryIcon(cat.icon, 40)}
                </div>
                <div>
                  <span className={`category-track-pill track-${track.toLowerCase()}`}>
                    {trackFilters.find(item => item.value === track)?.label}
                  </span>
                  <strong>{cat.name}</strong>
                  <p>{cat.description}</p>
                </div>
              </div>
              <div className="category-card-footer">
                <span>{trackedCount > 0 ? `${trackedCount} 道已跟踪` : '进入专项'}</span>
                <ArrowRightOutlined />
              </div>
            </button>
          </Col>
          )
        })}
      </Row>
    </div>
  )
}
