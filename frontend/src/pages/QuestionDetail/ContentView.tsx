import { Collapse, Typography } from 'antd'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import DiagramBlock from './DiagramBlock'
import type { Question, CodeExample, Diagram } from '../../types'

const { Text } = Typography

interface Props {
  question: Question
  defaultOpen?: boolean
}

function parseJson<T>(val: string | undefined | null): T[] {
  if (!val) return []
  try { return JSON.parse(val) } catch { return [] }
}

export default function ContentView({ question, defaultOpen = false }: Props) {
  const sections: { key: string; label: string; content: React.ReactNode }[] = []

  if (question.summary) {
    sections.push({
      key: 'summary',
      label: '摘要',
      content: <Text style={{ background: '#f5f5f5', padding: '8px 16px', display: 'block', borderRadius: 6 }}>{question.summary}</Text>,
    })
  }

  if (question.content) {
    sections.push({
      key: 'content',
      label: '题目内容',
      content: <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{question.content}</Markdown>,
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
        content: <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{value}</Markdown>,
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
    <Collapse
      defaultActiveKey={defaultOpen ? sections.map(s => s.key) : sections.length > 0 ? [sections[0].key] : []}
      items={sections.map(s => ({ key: s.key, label: s.label, children: s.content }))}
      expandIconPosition="end"
    />
  )
}
