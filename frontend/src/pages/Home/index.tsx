import { Typography } from 'antd'
import CategoryGrid from './CategoryGrid'
import HotQuestions from './HotQuestions'

const { Title } = Typography

export default function Home() {
  return (
    <div>
      <Title level={3}>热门面试题库</Title>
      <CategoryGrid />
      <Title level={4} style={{ marginTop: 32 }}>热门题目排行榜</Title>
      <HotQuestions />
    </div>
  )
}
