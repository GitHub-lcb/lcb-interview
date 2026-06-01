import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import AppHeader from './Header'

const { Content } = Layout

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#FAFAF9' }}>
      <AppHeader />
      <Content className="main-content" style={{
        padding: '28px 24px',
        minHeight: 280,
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
      }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
