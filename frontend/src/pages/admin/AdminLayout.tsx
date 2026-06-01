import { useEffect } from 'react'
import { Layout, Menu } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, RobotOutlined, FileSearchOutlined
} from '@ant-design/icons'

const { Sider, Content } = Layout

const menuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/ai-generate', icon: <RobotOutlined />, label: '生成题目' },
  { key: '/admin/draft-review', icon: <FileSearchOutlined />, label: '审核草稿' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      navigate('/admin/login')
    }
  }, [navigate])

  return (
    <Layout style={{ minHeight: '100vh', background: '#FAFAF9' }}>
      <Sider theme="light" style={{ borderRight: '1px solid #E4E4E7', background: '#FFFFFF' }}>
        <div style={{
          padding: '20px 16px',
          fontFamily: "'DM Serif Display', serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#18181B',
          letterSpacing: '-0.03em',
          borderBottom: '1px solid #F1F1F3',
        }}>
          LCB Admin
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none', marginTop: 8 }}
        />
      </Sider>
      <Content style={{ padding: 32 }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
