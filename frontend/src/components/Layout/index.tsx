import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import AppHeader from './Header'
import GlobalRecoveryDock from '../GlobalRecoveryDock'
import packageJson from '../../../package.json'

const { Content, Footer } = Layout

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
      <Footer style={{
        background: 'transparent',
        color: '#8C8C8C',
        fontSize: 12,
        lineHeight: 1.5,
        padding: '0 24px 20px',
        textAlign: 'center',
      }}>
        <span aria-label="前端版本号">v{packageJson.version}</span>
      </Footer>
    </Layout>
  )
}
