import { useState } from 'react'
import { Layout, Menu, Drawer, Button, Grid } from 'antd'
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, RobotOutlined, FileSearchOutlined, MenuOutlined
} from '@ant-design/icons'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

const menuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/ai-generate', icon: <RobotOutlined />, label: '生成题目' },
  { key: '/admin/draft-review', icon: <FileSearchOutlined />, label: '审核草稿' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.lg
  const [drawerOpen, setDrawerOpen] = useState(false)

  const token = localStorage.getItem('adminToken')
  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  const menuComponent = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key)
        if (isMobile) { setDrawerOpen(false) }
      }}
      style={{ borderInlineEnd: 'none', marginTop: isMobile ? 0 : 8 }}
    />
  )

  if (isMobile) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#FAFAF9' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E4E4E7',
        }}>
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
            onClick={() => setDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#18181B',
            letterSpacing: '-0.03em',
          }}>
            LCB Admin
          </span>
        </div>
        <Drawer
          title={<span style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700 }}>LCB Admin</span>}
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          width={260}
          styles={{ body: { padding: 0 } }}
        >
          {menuComponent}
        </Drawer>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#FAFAF9' }}>
      <Sider theme="light" width={220} style={{ borderRight: '1px solid #E4E4E7', background: '#FFFFFF' }}>
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
        {menuComponent}
      </Sider>
      <Content style={{ padding: 32 }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
