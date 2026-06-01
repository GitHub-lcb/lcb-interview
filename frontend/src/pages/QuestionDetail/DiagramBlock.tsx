import { Image } from 'antd'
import type { Diagram } from '../../types'

interface Props {
  diagrams: Diagram[]
}

export default function DiagramBlock({ diagrams }: Props) {
  if (!diagrams || diagrams.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {diagrams.map((d, i) => (
        <div key={i} style={{
          background: '#FAFAFA',
          borderRadius: 10,
          padding: 20,
          border: '1px solid #F1F1F3',
        }}>
          <div style={{ textAlign: 'center', overflowX: 'auto' }}>
            {d.type === 'svg' ? (
              <div dangerouslySetInnerHTML={{ __html: d.content }}
                   style={{ maxWidth: '100%', display: 'inline-block' }} />
            ) : (
              <Image src={d.content} alt={d.alt} style={{ maxWidth: '100%' }} />
            )}
          </div>
          {d.caption && (
            <div style={{
              textAlign: 'center',
              marginTop: 12,
              fontSize: 13,
              color: '#71717A',
              fontStyle: 'italic',
            }}>
              {d.caption}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
