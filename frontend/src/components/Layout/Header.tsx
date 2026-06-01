import { Layout, Input } from 'antd'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, FireOutlined, BookOutlined } from '@ant-design/icons'

const { Header } = Layout

export default function AppHeader() {
  const navigate = useNavigate()

  return (
    <Header style={{
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      height: 56,
      lineHeight: '56px',
      borderBottom: '1px solid #E4E4E7',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      gap: 8,
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={() => navigate('/')}
      >
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "'DM Serif Display', serif",
        }}>
          L
        </div>
        <span className="logo-text" style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "'DM Serif Display', serif",
          color: '#18181B',
          letterSpacing: '-0.03em',
          whiteSpace: 'nowrap',
        }}>
          LCB Interview
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 13,
        color: '#71717A',
      }}>
        <div
          style={{
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            lineHeight: 1,
          }}
          onClick={() => navigate('/')}
          onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <FireOutlined /> <span className="nav-label">热门</span>
        </div>
        <div
          style={{
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            lineHeight: 1,
          }}
          onClick={() => navigate('/banks')}
          onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <BookOutlined /> <span className="nav-label">题库</span>
        </div>
      </div>

      <Input
        prefix={<SearchOutlined style={{ color: '#A1A1AA', fontSize: 13 }} />}
        placeholder="搜索..."
        variant="filled"
        allowClear
        onPressEnter={(e) => {
          const value = (e.target as HTMLInputElement).value
          if (value.trim()) {
            navigate(`/search?q=${encodeURIComponent(value.trim())}`)
          }
        }}
        style={{
          maxWidth: 240,
          minWidth: 80,
          borderRadius: 8,
          background: '#F4F4F5',
          border: 'none',
          height: 34,
          fontSize: 13,
        }}
      />
    </Header>
  )
}
