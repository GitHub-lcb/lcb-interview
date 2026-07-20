import { useEffect, useState } from 'react'
import { Layout, Input } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOutlined,
  CalendarOutlined,
  HomeOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  SearchOutlined,
  SolutionOutlined,
  ToolOutlined,
} from '@ant-design/icons'

const { Header } = Layout
const { Search } = Input

const navItems = [
  { path: '/', label: '首页', icon: <HomeOutlined /> },
  { path: '/practice', label: '模拟', icon: <PlayCircleOutlined /> },
  { path: '/study', label: '学习', icon: <CalendarOutlined /> },
  { path: '/banks', label: '题库', icon: <BookOutlined /> },
  { path: '/routes', label: '路线', icon: <ReadOutlined /> },
  { path: '/experiences', label: '面经', icon: <SolutionOutlined /> },
  { path: '/tools', label: '工具', icon: <ToolOutlined /> },
]

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    setSearchValue(searchParams.get('q') || '')
  }, [searchParams])

  const runSearch = (value: string) => {
    const keyword = value.trim()
    if (keyword) {
      navigate(`/search?q=${encodeURIComponent(keyword)}`)
      return
    }
    if (location.pathname === '/search') {
      navigate('/search')
    }
  }

  return (
    <Header className="app-header">
      <div
        className="app-brand"
        onClick={() => navigate('/')}
      >
        <div className="app-brand-mark">
          L
        </div>
        <span className="logo-text app-brand-name">
          LCB Interview
        </span>
      </div>

      <nav className="app-nav" aria-label="主导航">
        {navItems.map(item => {
          const active = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              type="button"
              className={active ? 'app-nav-item active' : 'app-nav-item'}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <Search
        className="app-header-search"
        prefix={<SearchOutlined style={{ color: '#A1A1AA', fontSize: 13 }} />}
        placeholder="搜索..."
        variant="filled"
        allowClear
        value={searchValue}
        onChange={event => setSearchValue(event.target.value)}
        onSearch={runSearch}
      />
    </Header>
  )
}
