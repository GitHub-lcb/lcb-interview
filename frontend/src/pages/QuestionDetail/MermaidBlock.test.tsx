import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MermaidBlock from './MermaidBlock'

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

vi.mock('mermaid', () => ({
  default: mermaidMocks,
}))

describe('MermaidBlock', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows repair guidance and raw source when AI generated Mermaid cannot render', async () => {
    mermaidMocks.render.mockRejectedValueOnce(new Error('Parse error on line 7'))

    render(<MermaidBlock code={`flowchart TD
A[开始排序查询] --> B{是否使用索引排序?}
B -- 否 --> E[filesort]
E --> F[构造排序元组(包含排序键和行数据/主键)]`} />)

    expect(await screen.findByText('图表渲染失败')).toBeInTheDocument()
    expect(screen.getByText(/AI 生成的 Mermaid 图解语法不合法/)).toBeInTheDocument()
    expect(screen.getByText(/Parse error on line 7/)).toBeInTheDocument()
    expect(screen.getByText((_, element) => (
      element?.tagName.toLowerCase() === 'pre'
      && element.textContent?.includes('F[构造排序元组(包含排序键和行数据/主键)]')
    ))).toBeInTheDocument()
  })
})
