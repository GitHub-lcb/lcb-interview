import { useEffect, useState, type ReactNode } from 'react'
import { Layout, Input } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOutlined,
  CalendarOutlined,
  ExperimentOutlined,
  HomeOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import packageJson from '../../../package.json'

const { Header } = Layout
const { Search } = Input

interface NavItem {
  path: string
  label: string
  icon: ReactNode
  /** 需要高亮该入口的路径前缀，避免子页面切走后导航失去上下文。 */
  match: string[]
}

const navItems: NavItem[] = [
  { path: '/', label: '首页', icon: <HomeOutlined />, match: ['/'] },
  { path: '/banks', label: '题库', icon: <BookOutlined />, match: ['/banks', '/bank/', '/question/', '/search'] },
  { path: '/training', label: '训练', icon: <PlayCircleOutlined />, match: ['/training', '/practice', '/recall', '/experiences'] },
  { path: '/study', label: '学习', icon: <CalendarOutlined />, match: ['/study', '/routes', '/knowledge'] },
]

const labNavItem: NavItem = {
  path: '/lab',
  label: '实验室',
  icon: <ExperimentOutlined />,
  match: ['/lab', '/tools'],
}

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === '/') {
    return pathname === '/'
  }
  return item.match.some(prefix => pathname === prefix || pathname.startsWith(prefix))
}

/** 把当前时间格式化为参考站同款「2026.08.01 11:25:36」仪表盘时间戳。 */
function formatLabTime(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return `${date} ${time}`
}

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState('')
  const [clock, setClock] = useState(() => formatLabTime(new Date()))

  useEffect(() => {
    setSearchValue(searchParams.get('q') || '')
  }, [searchParams])

  // 实时时钟每秒刷新一次，只在头部挂载期间运行，卸载时清理定时器。
  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatLabTime(new Date())), 1000)
    return () => window.clearInterval(timer)
  }, [])

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
        <span className="app-brand-version" aria-label="站点版本号">v{packageJson.version}</span>
      </div>

      <nav className="app-nav" aria-label="主导航">
        {navItems.map(item => {
          const active = isNavItemActive(item, location.pathname)
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
        <span className="app-nav-divider" aria-hidden="true" />
        <button
          type="button"
          className={isNavItemActive(labNavItem, location.pathname)
            ? 'app-nav-item app-nav-item-lab active'
            : 'app-nav-item app-nav-item-lab'}
          onClick={() => navigate(labNavItem.path)}
        >
          {labNavItem.icon}
          <span className="nav-label">{labNavItem.label}</span>
        </button>
      </nav>

      <div className="app-header-side">
        {/* 窄屏下搜索框隐藏，保留图标入口跳转搜索页（见 global.css 480px 断点） */}
        <button
          type="button"
          className="app-header-mobile-search"
          aria-label="搜索"
          onClick={() => navigate('/search')}
        >
          <SearchOutlined />
        </button>
        <span className="app-header-clock" aria-label="实时时钟">
          <span className="app-header-clock-dot" aria-hidden="true" />
          {clock} 已连接
        </span>
        <Search
          className="app-header-search"
          prefix={<SearchOutlined style={{ color: '#9AA5AB', fontSize: 13 }} />}
          placeholder="搜索..."
          variant="filled"
          allowClear
          value={searchValue}
          onChange={event => setSearchValue(event.target.value)}
          onSearch={runSearch}
        />
      </div>
    </Header>
  )
}
