import { useState } from 'react'
import { Button } from 'antd'
import { CopyOutlined, CheckOutlined } from '@ant-design/icons'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { CodeExample } from '../../types'

interface Props {
  examples: CodeExample[]
}

export default function CodeBlock({ examples }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)

  if (!examples || examples.length === 0) return null

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E4E4E7' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#F8F8FA',
        borderBottom: '1px solid #E4E4E7',
        padding: '0 4px',
      }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: activeTab === i ? '#FFFFFF' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === i ? 500 : 400,
                color: activeTab === i ? '#18181B' : '#71717A',
                borderRadius: '6px 6px 0 0',
                marginTop: 4,
                transition: 'all 0.15s',
              }}
            >
              {ex.title || ex.lang.toUpperCase()}
            </button>
          ))}
        </div>
        <Button
          size="small"
          type="text"
          icon={copied ? <CheckOutlined style={{ color: '#059669' }} /> : <CopyOutlined />}
          onClick={() => handleCopy(examples[activeTab].code)}
          style={{ marginRight: 8 }}
        >
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <div style={{ padding: '16px 20px', background: '#FAFAFA', overflowX: 'auto' }}>
        {examples[activeTab].description && (
          <div style={{ fontSize: 13, color: '#71717A', marginBottom: 12, lineHeight: 1.5 }}>
            {examples[activeTab].description}
          </div>
        )}
        <div className="prose" style={{ fontSize: 14 }}>
          <Markdown rehypePlugins={[rehypeHighlight]}>
            {"```" + examples[activeTab].lang + "\n" + examples[activeTab].code + "\n```"}
          </Markdown>
        </div>
      </div>
    </div>
  )
}
