import { useState, type ReactNode } from 'react'
import { DownOutlined } from '@ant-design/icons'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import DiagramBlock from './DiagramBlock'
import type { Question, CodeExample, Diagram } from '../../types'
import { getQuickAnswer } from '../../utils/answerQuality'

interface Props {
  question: Question
  defaultOpen?: boolean
}

interface SectionItem {
  key: string
  label: string
  content: ReactNode
  defaultOpen?: boolean
}

function parseJson<T>(val: string | undefined | null): T[] {
  if (!val) {
    return []
  }
  try {
    return JSON.parse(val)
  } catch {
    return []
  }
}

function Section({
  index,
  label,
  children,
  defaultOpen,
}: {
  index: number
  label: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="answer-section">
      <button
        className="answer-section-toggle"
        onClick={() => setOpen(!open)}
      >
        <span className="answer-section-label">
          <em>{String(index + 1).padStart(2, '0')}</em>
          {label}
        </span>
        <span className={open ? 'answer-section-icon open' : 'answer-section-icon'}>
          <DownOutlined />
        </span>
      </button>
      {open && (
        <div className="answer-section-body">
          {children}
        </div>
      )}
    </div>
  )
}

export default function ContentView({ question, defaultOpen = false }: Props) {
  const sections: SectionItem[] = [
    {
      key: 'quick-answer',
      label: '30 秒口径',
      defaultOpen: true,
      content: <div className="quick-answer-box">{getQuickAnswer(question)}</div>,
    },
  ]

  const displayContent = question.content || question.answer
  if (displayContent) {
    sections.push({
      key: 'content',
      label: '标准回答',
      defaultOpen: true,
      content: (
        <div className="prose">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{displayContent}</Markdown>
        </div>
      ),
    })
  }

  const fields: Array<[string, string, string | undefined | null]> = [
    ['principle', '原理深挖', question.principle],
    ['comparison', '对比分析', question.comparison],
    ['scenario', '适用场景', question.scenario],
    ['risk', '风险误区', question.risk],
    ['projectExp', '项目落地', question.projectExp],
  ]

  for (const [key, label, value] of fields) {
    if (value) {
      sections.push({
        key,
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
      {sections.map((section, index) => (
        <Section
          key={section.key}
          index={index}
          label={section.label}
          defaultOpen={defaultOpen || section.defaultOpen || index < 2}
        >
          {section.content}
        </Section>
      ))}
    </div>
  )
}
