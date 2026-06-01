import CategoryGrid from './CategoryGrid'
import HotQuestions from './HotQuestions'

export default function Home() {
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h1 className="section-title" style={{ fontSize: 28 }}>热门面试题库</h1>
        <p className="section-subtitle">精选 Java 技术栈高频面试题</p>
        <CategoryGrid />
      </div>

      <hr className="magazine-divider" />

      <div>
        <h2 className="section-title" style={{ fontSize: 24 }}>热门题目排行榜</h2>
        <p className="section-subtitle">最受关注的面试题 Top 10</p>
        <HotQuestions />
      </div>
    </div>
  )
}
