import { Layout, Input, theme } from 'antd'
import { useNavigate } from 'react-router-dom'
import { BookOutlined } from '@ant-design/icons'

const { Header } = Layout

export default function AppHeader() {
  const navigate = useNavigate()
  const { token } = theme.useToken()

  return (
    <Header style={{
      background: token.colorBgContainer,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', cursor: 'pointer', marginRight: 32 }}
           onClick={() => navigate('/')}>
        <BookOutlined /> LCB Interview
      </div>
      <Input.Search
        placeholder="搜索面试题..."
        onSearch={(value) => navigate(`/search?q=${encodeURIComponent(value)}`)}
        style={{ maxWidth: 400 }}
      />
    </Header>
  )
}
