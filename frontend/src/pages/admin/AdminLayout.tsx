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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ color: '#fff', padding: 16, fontWeight: 'bold', fontSize: 16 }}>Admin</div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems}
              onClick={({ key }) => navigate(key)} />
      </Sider>
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
