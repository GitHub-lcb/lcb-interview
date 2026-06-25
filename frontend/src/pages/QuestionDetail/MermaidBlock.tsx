import { useEffect, useRef, useState, type JSX } from 'react'
import { Alert, Spin } from 'antd'
import type { Mermaid } from 'mermaid'

interface Props {
  code: string
}

// 是否在模块作用域已加载过 mermaid，避免重复 init。
let mermaidReady: boolean = false

/**
 * Mermaid 图解渲染块。
 *
 * 之所以独立成组件并用 dynamic import 动态加载 mermaid，是因为 mermaid 体积较大
 * （含 d3/dagre/cytoscape 等），若打包进 main chunk 会显著拖慢题库首屏。
 * 通过动态 import + manualChunks 分到 diagram-vendor，只在详情页遇到 mermaid 图时才下载。
 */
export default function MermaidBlock({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState<JSX.Element | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const renderIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const currentRenderId = renderIdRef.current++
    const id = `mermaid-${currentRenderId}`

    const render = async (mermaid: Mermaid) => {
      try {
        // 首次加载需初始化主题；重复 init 会抛错，因此用 mermaidReady 标记。
        if (!mermaidReady) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            // 内嵌在详请页容器内，统一使用中性背景。
            themeVariables: {
              background: '#FFFFFF',
              primaryColor: '#EFF6FF',
              primaryTextColor: '#18181B',
              primaryBorderColor: '#2563EB',
              lineColor: '#71717A',
              secondaryColor: '#F4F4F5',
              tertiaryColor: '#FAFAFA',
            },
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
            sequence: { useMaxWidth: true },
            gantt: { useMaxWidth: true },
          })
          mermaidReady = true
        }
        const { svg } = await mermaid.render(id, code)
        if (cancelled) {
          return
        }
        setRendered(<div dangerouslySetInnerHTML={{ __html: svg }} />)
        setError(null)
      } catch (e) {
        if (cancelled) {
          return
        }
        // mermaid 语法错误较常见，展示原始代码 + 错误提示，避免整页崩溃。
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    // 用 dynamic import 触发 diagram-vendor 分包加载。
    import('mermaid')
      .then(mod => render(mod.default))
      .catch(e => {
        if (cancelled) {
          return
        }
        setError(`加载图表渲染库失败：${e instanceof Error ? e.message : String(e)}`)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  // 渲染失败时回退展示原始 mermaid 源码，保证可读性。
  if (error) {
    return (
      <div>
        <Alert
          type="warning"
          message="图表渲染失败"
          description={(
            <div style={{ textAlign: 'left' }}>
              <div>
                AI 生成的 Mermaid 图解语法不合法，已保留源码。可以在后台重新生成答案，或审核时把节点文本改成 A[&quot;文本&quot;] 格式。
              </div>
              <div style={{ marginTop: 8 }}>错误详情：{error}</div>
            </div>
          )}
          showIcon
          style={{ marginBottom: 12 }}
        />
        <pre style={{
          background: '#FAFAFA',
          padding: 12,
          borderRadius: 8,
          overflowX: 'auto',
          fontSize: 13,
          color: '#52525B',
        }}>
          {code}
        </pre>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin size="small" />
          <div style={{ marginTop: 8, fontSize: 13, color: '#71717A' }}>渲染图表中...</div>
        </div>
      ) : (
        rendered
      )}
    </div>
  )
}
