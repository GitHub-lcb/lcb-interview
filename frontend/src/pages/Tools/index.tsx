import { useEffect, useState } from 'react'
import { Button, Tabs } from 'antd'
import { LogoutOutlined, ReadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReadingExcerptPanel from '../../components/ReadingExcerptPanel'
import LotteryKl8Panel from '../../components/LotteryKl8Panel'
import { getCurrentUser } from '../../api/auth'
import { clearUserToken, readUserToken } from '../../utils/authToken'
import type { AuthUser } from '../../types'

export default function Tools() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (!readUserToken()) {
      navigate('/auth/login?from=/tools', { replace: true })
      return
    }
    getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/auth/login?from=/tools', { replace: true }))
  }, [navigate])

  const handleLogout = () => {
    clearUserToken()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="tools-page">
      <header className="tools-header">
        <div>
          <div className="dashboard-kicker">个人工具</div>
          <h1>书摘库与数字推荐</h1>
          <p>当前账号：{user?.displayName || user?.username || '读取中'}</p>
        </div>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </header>
      <Tabs
        className="tools-tabs"
        items={[
          {
            key: 'reading',
            label: <span><ReadOutlined /> 书摘库</span>,
            children: <ReadingExcerptPanel />,
          },
          {
            key: 'lottery',
            label: <span><ThunderboltOutlined /> 快乐8选5</span>,
            children: <LotteryKl8Panel />,
          },
        ]}
      />
    </div>
  )
}
