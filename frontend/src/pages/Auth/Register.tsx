import { Button, Form, Input } from 'antd'
import { LockOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../../api/auth'
import { writeUserToken } from '../../utils/authToken'
import { emitFeedbackSuccess } from '../../utils/feedbackMessage'
import type { RegisterRequest } from '../../types'

export default function Register() {
  const navigate = useNavigate()

  const handleFinish = async (values: RegisterRequest) => {
    const response = await registerUser(values)
    writeUserToken(response.token)
    emitFeedbackSuccess('注册成功')
    navigate('/lab', { replace: true })
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="dashboard-kicker">实验室账号</div>
        <h1>注册</h1>
        <p>实验室是独立于面试训练主线的实验区。创建账号后，书摘和统计历史会按用户隔离保存。</p>
        <Form layout="vertical" onFinish={handleFinish}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少 3 位' }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="displayName" label="昵称">
            <Input autoComplete="nickname" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '至少 8 位' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} block>
            注册并进入实验室
          </Button>
        </Form>
        <div className="auth-switch">
          <span>已有账号？</span>
          <Link to="/auth/login">登录</Link>
        </div>
      </section>
    </main>
  )
}
