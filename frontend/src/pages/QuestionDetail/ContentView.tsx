import { useId, useRef, useState, type ReactNode } from 'react'
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
  sectionRef,
}: {
  index: number
  label: string
  children: ReactNode
  defaultOpen?: boolean
  sectionRef: (el: HTMLElement | null) => void
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const panelId = useId()
  return (
    <div className="answer-section" ref={sectionRef}>
      <button
        type="button"
        className="answer-section-toggle"
        aria-expanded={open}
        aria-controls={panelId}
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
        <div id={panelId} className="answer-section-body">
          {children}
        </div>
      )}
    </div>
  )
}

export default function ContentView({ question, defaultOpen = false }: Props) {
  // 记录每个 section 对应的 DOM 节点，供 TOC 点击跳转使用。
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
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

  const jumpTo = (key: string) => {
    const el = sectionRefs.current[key]
    if (!el) {
      return
    }
    // 若 section 处于折叠态，先模拟点击展开后再滚动，避免定位不到内容。
    const toggle = el.querySelector<HTMLButtonElement>('.answer-section-toggle')
    const isOpen = toggle?.getAttribute('aria-expanded') === 'true'
    if (!isOpen) {
      toggle?.click()
    }
    // 等待展开后下一帧再滚动，避免位置算错。
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // TOC 仅在段落数超过 3 时呈现，避免短答案反而出现冗余目录。
  const showToc = sections.length > 3

  return (
    <div>
      {showToc && (
        <nav className="answer-toc" aria-label="答案目录">
          {sections.map((section, index) => (
            <button
              key={section.key}
              type="button"
              className="answer-toc-item"
              onClick={() => jumpTo(section.key)}
            >
              <span className="answer-toc-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="answer-toc-label">{section.label}</span>
            </button>
          ))}
        </nav>
      )}
      {sections.map((section, index) => (
        <Section
          key={section.key}
          index={index}
          label={section.label}
          defaultOpen={defaultOpen || section.defaultOpen || index < 2}
          sectionRef={(el) => {
            sectionRefs.current[section.key] = el
          }}
        >
          {section.content}
        </Section>
      ))}
    </div>
  )
}