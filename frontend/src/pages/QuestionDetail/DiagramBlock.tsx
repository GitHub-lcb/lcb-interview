import { Image, Alert } from 'antd'
import type { Diagram } from '../../types'
import MermaidBlock from './MermaidBlock'

interface Props {
  diagrams: Diagram[]
}

/**
 * 图解渲染块。根据每个图解对象的 type 分派到 Mermaid/SVG/图片三种渲染方式。
 *
 * 早期只支持 svg/url 两种类型，mermaid 源码会被当成图片 URL 加载必失败且无提示，
 * 导致最能体现复杂机制的流程图/时序图实际不可用。这里按 type 显式分派并容错降级。
 */
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
            {renderDiagram(d)}
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

/**
 * 按 type 显式分派渲染，避免把 mermaid 源码当成图片 URL 导致加载失败无反馈。
 */
function renderDiagram(d: Diagram) {
  if (!d.type || d.type === 'url') {
    // 仅有 url 类型走图片渲染；其它已知 type 不进此分支，避免把字符串当 URL 误判。
    return <Image src={d.content} alt={d.alt || '图解'} style={{ maxWidth: '100%' }} />
  }

  if (d.type === 'svg') {
    return (
      <div dangerouslySetInnerHTML={{ __html: d.content }}
           style={{ maxWidth: '100%', display: 'inline-block' }} />
    )
  }

  if (d.type === 'mermaid') {
    return <MermaidBlock code={d.content} />
  }

  // 未知 type 容错：提示用户数据格式不支持，而非静默空白。
  return (
    <Alert
      type="warning"
      message={`暂不支持的图解类型：${d.type}`}
      showIcon
    />
  )
}