import { Tabs, Typography, Button } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { CodeExample } from '../../types'

const { Text } = Typography

interface Props {
  examples: CodeExample[]
}

export default function CodeBlock({ examples }: Props) {
  if (!examples || examples.length === 0) return null

  const items = examples.map((ex, i) => ({
    key: String(i),
    label: ex.title || ex.lang.toUpperCase(),
    children: (
      <div>
        {ex.description && <Text type="secondary">{ex.description}</Text>}
        <div style={{ position: 'relative', marginTop: 8 }}>
          <Button
            size="small"
            icon={<CopyOutlined />}
            style={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
            onClick={() => navigator.clipboard.writeText(ex.code)}
          />
          <Markdown rehypePlugins={[rehypeHighlight]}>
            {"```" + ex.lang + "\n" + ex.code + "\n```"}
          </Markdown>
        </div>
      </div>
    ),
  }))

  return <Tabs items={items} />
}
