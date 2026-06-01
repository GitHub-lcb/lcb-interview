import { useState } from 'react'
import { Input, Button, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function AdminLogin() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await axios.get('/api/admin/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.code === 200) {
        localStorage.setItem('adminToken', token)
        message.success('登录成功')
        navigate('/admin/dashboard')
      } else {
        message.error('验证失败')
      }
    } catch {
      message.error('验证失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAFAF9',
    }}>
      <div className="magazine-card" style={{
        padding: 40,
        width: 400,
        maxWidth: '90%',
      }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#18181B',
          letterSpacing: '-0.03em',
          margin: '0 0 8px 0',
        }}>
          管理员登录
        </h1>
        <p style={{ fontSize: 14, color: '#71717A', margin: '0 0 28px 0' }}>
          请输入管理员 Token 登录后台
        </p>
        <Input.Password
          placeholder="请输入 Token"
          value={token}
          onChange={e => setToken(e.target.value)}
          onPressEnter={handleLogin}
          variant="filled"
          size="large"
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          onClick={handleLogin}
          style={{ borderRadius: 8, height: 44 }}
        >
          登录
        </Button>
      </div>
    </div>
  )
}
