import { useEffect, useState } from 'react'
import { Button, Segmented, Spin, Tabs } from 'antd'
import { LogoutOutlined, ReadOutlined, ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReadingExcerptPanel from '../../components/ReadingExcerptPanel'
import LotteryKl8Panel from '../../components/LotteryKl8Panel'
import SsqPanel from '../../components/SsqPanel'
import DltPanel from '../../components/DltPanel'
import SimulationPanel from '../../components/SimulationPanel'
import { getCurrentUser } from '../../api/auth'
import { clearUserToken, readUserToken } from '../../utils/authToken'
import type { AuthUser } from '../../types'

export default function Tools() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [lotteryType, setLotteryType] = useState<string>('kl8')

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
          <h1>数字预测与个人工具</h1>
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
                <Segmented
                  block
                  className="lottery-game-switch"
                  aria-label="选择号码预测玩法"
                  options={[
                    { label: '快乐8', value: 'kl8' },
                    { label: '双色球', value: 'ssq' },
                    { label: '大乐透', value: 'dlt' },
                  ]}
                  value={lotteryType}
                  onChange={value => setLotteryType(String(value))}
                />
                <div className="lottery-game-panel">
                  {lotteryType === 'kl8' && <LotteryKl8Panel />}
                  {lotteryType === 'ssq' && <SsqPanel />}
                  {lotteryType === 'dlt' && <DltPanel />}
                </div>
              </div>
            ),
          },
          {
            key: 'simulation',
            label: <span><ExperimentOutlined /> 模拟战场</span>,
            children: <SimulationPanel />,
          },
          {
            key: 'reading',
            label: <span><ReadOutlined /> 书摘库</span>,
            children: <ReadingExcerptPanel />,
          },
        ]}
      />
    </div>
  )
}
