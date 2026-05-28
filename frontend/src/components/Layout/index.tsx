import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import AppHeader from './Header'
import SideMenu from './SideMenu'

const { Content, Sider } = Layout

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Layout>
        <Sider breakpoint="lg" collapsedWidth={0} style={{ background: '#fff' }}>
          <SideMenu />
        </Sider>
        <Content style={{ padding: '24px', margin: 0, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
