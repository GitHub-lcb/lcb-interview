import { useEffect, useMemo, useState } from 'react'
import { Skeleton, Empty, Alert, Button, Input, Segmented } from 'antd'
import { AppstoreOutlined, ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getCategories } from '../../api/category'
import { getCategoryIcon } from '../../utils/categoryIcons'
import type { Category } from '../../types'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { categoryGroupForRole, resolveCategoryGroup, type CategoryGroupKey } from '../../utils/categoryExplorer'
import { resolveRoleFocus } from '../../utils/roleFocus'

const groupOptions: { label: string; value: CategoryGroupKey }[] = [
  { label: '后端', value: 'backend' },
  { label: '前端', value: 'frontend' },
  { label: 'AI', value: 'ai' },
  { label: '架构运维', value: 'ops' },
  { label: '通用', value: 'general' },
]

const HOME_CATEGORY_LIMIT = 8

export default function CategoryGrid() {
  const { progress } = useStudyProgress()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [activeGroup, setActiveGroup] = useState<CategoryGroupKey>(
    () => categoryGroupForRole(resolveRoleFocus(progress.targetRole)),
  )

  const filteredCategories = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return categories.filter(category => {
      if (normalizedKeyword) {
        return `${category.name} ${category.description}`.toLowerCase().includes(normalizedKeyword)
      }
      return resolveCategoryGroup(category) === activeGroup
    })
  }, [activeGroup, categories, keyword])
  const visibleCategories = filteredCategories.slice(0, HOME_CATEGORY_LIMIT)

  const fetch = () => {
    setLoading(true)
    setError(false)
    getCategories({ silentGlobalError: true }).then(data => {
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

  useEffect(() => {
    if (!keyword) {
      setActiveGroup(categoryGroupForRole(resolveRoleFocus(progress.targetRole)))
    }
  }, [keyword, progress.targetRole])

  if (loading) {
    return (
      <div className="category-explorer-grid category-explorer-loading">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="category-explorer-item category-card-skeleton" key={index}>
            <Skeleton active paragraph={{ rows: 1 }} />
          </div>
        ))}
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

  return (
    <div className="category-explorer">
      <div className="category-explorer-toolbar">
        <Segmented<CategoryGroupKey>
          aria-label="题库方向"
          value={activeGroup}
          options={groupOptions}
          onChange={setActiveGroup}
        />
        <Input
          allowClear
          value={keyword}
          prefix={<SearchOutlined />}
          placeholder="查找技术方向"
          onChange={event => setKeyword(event.target.value)}
        />
      </div>

      {visibleCategories.length === 0 ? (
        <Empty description={categories.length === 0 ? '暂无分类' : '没有匹配的技术方向'} />
      ) : (
        <div className="category-explorer-grid">
          {visibleCategories.map((cat, index) => (
          <Link
            className={`category-explorer-item fade-in-up stagger-${(index % 6) + 1}`}
            to={`/bank/${cat.id}`}
            aria-label={`${cat.name} ${cat.description} 浏览题库`}
            key={cat.id}
          >
            <div className="category-explorer-icon" aria-hidden="true">
              {getCategoryIcon(cat.icon, 30)}
            </div>
            <div>
              <strong>{cat.name}</strong>
              <span>{cat.description}</span>
            </div>
            <ArrowRightOutlined aria-hidden="true" />
          </Link>
          ))}
        </div>
      )}

      <div className="category-explorer-footer">
        <span>{keyword ? `找到 ${filteredCategories.length} 个方向` : `当前方向 ${filteredCategories.length} 个分类`}</span>
        <Link to="/banks">
          <Button type="link" icon={<AppstoreOutlined />}>
            查看全部 46 个方向
          </Button>
        </Link>
      </div>
    </div>
  )
}
