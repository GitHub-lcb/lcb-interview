import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import AppHeader from './Header'
import GlobalRecoveryDock from '../GlobalRecoveryDock'

const { Content } = Layout

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#FAFAF9' }}>
      <AppHeader />
      <Content className="main-content" style={{
        padding: '28px 24px',
        minHeight: 280,
        maxWidth: 1120,
        width: '100%',
        margin: '0 auto',
      }}>
        <GlobalRecoveryDock />
        <Outlet />
      </Content>
    </Layout>
  )
}
