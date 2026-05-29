import { Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { BookOutlined, FireOutlined } from '@ant-design/icons'

const items = [
  { key: '/', icon: <FireOutlined />, label: '热门' },
  { key: '/banks', icon: <BookOutlined />, label: '题库' },
]

export default function SideMenu() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => navigate(key)}
      style={{ borderInlineEnd: 'none' }}
    />
  )
}
