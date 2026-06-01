import { useState } from 'react'
import { DownOutlined } from '@ant-design/icons'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import DiagramBlock from './DiagramBlock'
import type { Question, CodeExample, Diagram } from '../../types'

interface Props {
  question: Question
  defaultOpen?: boolean
}

function parseJson<T>(val: string | undefined | null): T[] {
  if (!val) return []
  try { return JSON.parse(val) } catch { return [] }
}

function Section({ label, children, defaultOpen }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div style={{ borderBottom: '1px solid #E4E4E7' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '14px 16px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: "'DM Serif Display', serif",
          fontSize: 17,
          fontWeight: 700,
          color: '#18181B',
          letterSpacing: '-0.02em',
          textAlign: 'left',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.background = '#F4F4F5'
        }}
        onTouchEnd={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {label}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: open ? '#2563EB' : '#E4E4E7',
          color: open ? '#fff' : '#18181B',
          fontSize: 12,
          flexShrink: 0,
          transition: 'all 0.2s',
        }}>
          <DownOutlined style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 20px 16px', fontSize: 15, lineHeight: 1.8, color: '#52525B' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function ContentView({ question, defaultOpen = false }: Props) {
  const sections: { key: string; label: string; content: React.ReactNode }[] = []

  if (question.summary) {
    sections.push({
      key: 'summary',
      label: '摘要',
      content: (
        <div style={{
          background: '#F8F8FA',
          borderRadius: 8,
          padding: '14px 18px',
          fontSize: 14,
          lineHeight: 1.7,
          color: '#52525B',
          borderLeft: '3px solid #2563EB',
        }}>
          {question.summary}
        </div>
      ),
    })
  }

  if (question.content) {
    sections.push({
      key: 'content',
      label: '题目内容',
      content: (
        <div className="prose">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{question.content}</Markdown>
        </div>
      ),
    })
  }

  const fields: [string, string | undefined | null][] = [
    ['原理', question.principle],
    ['对比分析', question.comparison],
    ['适用场景', question.scenario],
    ['风险与避坑', question.risk],
    ['项目实战', question.projectExp],
  ]

  for (const [label, value] of fields) {
    if (value) {
      sections.push({
        key: label,
        label,
        content: (
          <div className="prose">
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{value}</Markdown>
          </div>
        ),
      })
    }
  }

  const codeExamples = parseJson<CodeExample>(question.codeExamples)
  if (codeExamples.length > 0) {
    sections.push({
      key: 'code',
      label: '代码示例',
      content: <CodeBlock examples={codeExamples} />,
    })
  }

  const diagrams = parseJson<Diagram>(question.diagrams)
  if (diagrams.length > 0) {
    sections.push({
      key: 'diagrams',
      label: '图解',
      content: <DiagramBlock diagrams={diagrams} />,
    })
  }

  return (
    <div>
      {sections.map((s, i) => (
        <Section key={s.key} label={s.label} defaultOpen={defaultOpen || i === 0}>
          {s.content}
        </Section>
      ))}
    </div>
  )
}
