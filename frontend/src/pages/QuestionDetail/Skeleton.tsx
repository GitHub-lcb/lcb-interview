import { Skeleton as AntSkeleton, Card } from 'antd'

export default function Skeleton() {
  return (
    <Card>
      <AntSkeleton active paragraph={{ rows: 1 }} />
      <div style={{ margin: '16px 0' }}>
        <AntSkeleton.Input active size="small" style={{ width: 80, marginRight: 8 }} />
        <AntSkeleton.Input active size="small" style={{ width: 60 }} />
      </div>
      <AntSkeleton active paragraph={{ rows: 6 }} />
    </Card>
  )
}
