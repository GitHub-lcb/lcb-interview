import { useEffect, useState } from 'react'
import { Button, Spin, Tabs } from 'antd'
import { LogoutOutlined, ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import LotteryKl8Panel from '../../components/LotteryKl8Panel'
import SimulationPanel from '../../components/SimulationPanel'
import { getCurrentUser } from '../../api/auth'
import { clearUserToken, readUserToken } from '../../utils/authToken'
import type { AuthUser } from '../../types'

export default function Lab() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!readUserToken()) {
      navigate('/auth/login?from=/lab', { replace: true })
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
          navigate('/auth/login?from=/lab', { replace: true })
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
      <div className="lab-page">
        <div className="tool-empty-panel"><Spin /></div>
      </div>
    )
  }

  return (
    <div className="lab-page">
      <header className="lab-header">
        <div>
          <div className="dashboard-kicker"><ExperimentOutlined /> 实验室 · LAB</div>
          <h1>实验室</h1>
          <p>与面试训练主线无关的探索性功能。它们可以玩、可以验证，但不承诺提升面试结果。</p>
          <p className="lab-account">当前账号：{user?.displayName || user?.username || '读取中'}</p>
        </div>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </header>

      <div className="lab-scope-note" role="note">
        <ExperimentOutlined />
        <div>
          <strong>实验性功能，不进入主导航主线</strong>
          <span>彩票结果独立随机，所有输出仅作统计演示，不构成投注建议。</span>
        </div>
      </div>

      <Tabs
        className="lab-tabs"
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
