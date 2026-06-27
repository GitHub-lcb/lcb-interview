import { Button, Form, Input } from 'antd'
import { LockOutlined, LoginOutlined, UserOutlined } from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '../../api/auth'
import { writeUserToken } from '../../utils/authToken'
import { emitFeedbackSuccess } from '../../utils/feedbackMessage'
import type { LoginRequest } from '../../types'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleFinish = async (values: LoginRequest) => {
    const response = await loginUser(values)
    writeUserToken(response.token)
    emitFeedbackSuccess('登录成功')
    const from = new URLSearchParams(location.search).get('from') || '/tools'
    navigate(from, { replace: true })
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="dashboard-kicker">个人工具</div>
        <h1>登录</h1>
        <p>登录后管理自己的书摘库和快乐8选5娱乐统计记录。</p>
        <Form layout="vertical" onFinish={handleFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<LoginOutlined />} block>
            登录
          </Button>
        </Form>
        <div className="auth-switch">
          <span>还没有账号？</span>
          <Link to="/auth/register">注册</Link>
        </div>
      </section>
    </main>
  )
}
