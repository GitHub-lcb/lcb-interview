import { Skeleton as AntSkeleton } from 'antd'

export default function Skeleton() {
  return (
    <article style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <AntSkeleton active title={{ width: '40%' }} paragraph={false} />
        <div style={{ marginTop: 16 }}>
          <AntSkeleton active title={{ width: '80%' }} paragraph={{ rows: 1, width: '50%' }} />
        </div>
      </div>

      <div className="magazine-card" style={{ padding: 32 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: '16px 0', borderBottom: i < 3 ? '1px solid #F1F1F3' : 'none' }}>
            <AntSkeleton active title={{ width: '30%' }} paragraph={{ rows: 2 }} />
          </div>
        ))}
      </div>
    </article>
  )
}
