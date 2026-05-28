import { Image, Typography } from 'antd'
import type { Diagram } from '../../types'

const { Text } = Typography

interface Props {
  diagrams: Diagram[]
}

export default function DiagramBlock({ diagrams }: Props) {
  if (!diagrams || diagrams.length === 0) return null

  return (
    <div>
      {diagrams.map((d, i) => (
        <div key={i} style={{ marginBottom: 16, textAlign: 'center' }}>
          {d.type === 'svg' ? (
            <div dangerouslySetInnerHTML={{ __html: d.content }}
                 style={{ maxWidth: '100%', overflowX: 'auto' }} />
          ) : (
            <Image src={d.content} alt={d.alt} style={{ maxWidth: '100%' }} />
          )}
          {d.caption && <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{d.caption}</Text>}
        </div>
      ))}
    </div>
  )
}
