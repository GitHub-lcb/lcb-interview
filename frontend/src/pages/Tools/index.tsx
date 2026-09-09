import { useEffect, useState } from 'react'
import { Button, Spin, Tabs } from 'antd'
import { LogoutOutlined, ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import LotteryKl8Panel from '../../components/LotteryKl8Panel'
import SimulationPanel from '../../components/SimulationPanel'
import { getCurrentUser } from '../../api/auth'
import { clearUserToken, readUserToken } from '../../utils/authToken'
import type { AuthUser } from '../../types'

export default function Tools() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!readUserToken()) {
      navigate('/auth/login?from=/tools', { replace: true })
      return () => {
        cancelled = true
      }
    }
    setCheckingUser(true)
    getCurrentUser()
      .then(nextUser => {
        if (!cancelled) {
          setUser(nextUser)
        }
      })
      .catch(() => {
        if (!cancelled) {
          navigate('/auth/login?from=/tools', { replace: true })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingUser(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleLogout = () => {
    clearUserToken()
    navigate('/auth/login', { replace: true })
  }

  if (checkingUser || !user) {
    return (
      <div className="tools-page">
        <div className="tool-empty-panel"><Spin /></div>
      </div>
    )
  }

  return (
    <div className="tools-page">
      <header className="tools-header">
        <div>
          <div className="dashboard-kicker">个人工具</div>
          <h1>快乐8 预测与回放</h1>
          <p>当前账号：{user?.displayName || user?.username || '读取中'}</p>
        </div>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </header>
      <Tabs
        className="tools-tabs"
        defaultActiveKey="lottery"
        items={[
          {
            key: 'lottery',
            label: <span><ThunderboltOutlined /> 号码预测</span>,
            children: (
              <div className="lottery-prediction-hub">
                <div className="lottery-game-panel">
                  <LotteryKl8Panel />
                </div>
              </div>
            ),
          },
          {
            key: 'simulation',
            label: <span><ExperimentOutlined /> 模拟战场</span>,
            children: <SimulationPanel />,
          },
        ]}
      />
    </div>
  )
}
