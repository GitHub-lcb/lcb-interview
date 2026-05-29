import { useState } from 'react'
import { Card, Input, Button, message, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

export default function AdminLogin() {
  const [token, setToken] = useState('')
  const navigate = useNavigate()

  const handleLogin = () => {
    if (!token.trim()) {
      message.error('请输入 Token')
      return
    }
    localStorage.setItem('adminToken', token.trim())
    message.success('已登录')
    navigate('/admin/dashboard')
  }

  return (
    <Card style={{ maxWidth: 400, margin: '100px auto' }}>
      <Title level={4} style={{ textAlign: 'center' }}>Admin 登录</Title>
      <Input.Password
        placeholder="请输入 Admin Token"
        value={token}
        onChange={e => setToken(e.target.value)}
        onPressEnter={handleLogin}
      />
      <Button type="primary" onClick={handleLogin} style={{ marginTop: 16, width: '100%' }}>
        登录
      </Button>
    </Card>
  )
}
