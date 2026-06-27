import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Form, Input, Modal, Popconfirm, Space, Tag } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import {
  createReadingExcerpt,
  deleteReadingExcerpt,
  exportReadingExcerpts,
  listReadingExcerpts,
  updateReadingExcerpt,
  type ReadingExcerptListParams,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { ReadingExcerpt, ReadingExcerptPayload } from '../types'

export default function ReadingExcerptPanel() {
  const [items, setItems] = useState<ReadingExcerpt[]>([])
  const [keyword, setKeyword] = useState('')
  const [tag, setTag] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ReadingExcerpt | null>(null)
  const [form] = Form.useForm<ReadingExcerptPayload>()

  const params = useMemo<ReadingExcerptListParams>(() => ({
    page: 0,
    size: 50,
    keyword: keyword.trim() || undefined,
    tag: tag.trim() || undefined,
    bookTitle: bookTitle.trim() || undefined,
  }), [bookTitle, keyword, tag])

  const load = async () => {
    setLoading(true)
    try {
      const page = await listReadingExcerpts(params)
      setItems(page.content)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (item: ReadingExcerpt) => {
    setEditing(item)
    form.setFieldsValue({
      bookTitle: item.bookTitle,
      author: item.author,
      content: item.content,
      note: item.note,
      tags: item.tags,
      chapter: item.chapter,
      pageNo: item.pageNo,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editing) {
      await updateReadingExcerpt(editing.id, values)
      emitFeedbackSuccess('书摘已更新')
    } else {
      await createReadingExcerpt(values)
      emitFeedbackSuccess('书摘已保存')
    }
    setModalOpen(false)
    await load()
  }

  const handleDelete = async (id: number) => {
    await deleteReadingExcerpt(id)
    emitFeedbackSuccess('书摘已删除')
    await load()
  }

  const handleExport = async () => {
    const exported = await exportReadingExcerpts(params)
    downloadMarkdown(exported.markdown, exported.fileName)
    emitFeedbackSuccess('书摘 Markdown 已导出')
  }

  const handleCopy = async (item: ReadingExcerpt) => {
    if (!navigator.clipboard?.writeText) {
      emitFeedbackWarning('剪贴板不可用')
      return
    }
    await navigator.clipboard.writeText(item.content)
    emitFeedbackSuccess('摘录已复制')
  }

  return (
    <section className="tool-section" aria-label="书摘库">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">书摘库</div>
          <h2>摘录、标签、搜索和导出</h2>
          <p>把阅读中可复用的句子、观点和评论沉淀下来，后续可以导出成 Markdown。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增书摘
          </Button>
        </div>
      </div>

      <div className="reading-toolbar">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索书名、作者、摘录或评论"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          allowClear
        />
        <Input placeholder="标签" value={tag} onChange={event => setTag(event.target.value)} allowClear />
        <Input placeholder="书名" value={bookTitle} onChange={event => setBookTitle(event.target.value)} allowClear />
      </div>

      {items.length === 0 ? (
        <div className="tool-empty-panel">
          <Empty description={loading ? '正在加载书摘' : '还没有符合条件的书摘'}>
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={openCreate}>
              添加第一条书摘
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="reading-list" aria-busy={loading}>
          {items.map(item => (
            <article key={item.id} className="reading-card">
              <div className="reading-card-main">
                <div className="reading-card-top">
                  <strong>{item.bookTitle}</strong>
                  <span>{item.author || '未知作者'}</span>
                </div>
                <p>{item.content}</p>
                {item.note && <small>{item.note}</small>}
                <div className="reading-meta">
                  {item.chapter && <em>{item.chapter}</em>}
                  {item.pageNo && <em>页码 {item.pageNo}</em>}
                  {item.tags.map(label => <Tag key={label}>{label}</Tag>)}
                </div>
              </div>
              <Space>
                <Button icon={<CopyOutlined />} onClick={() => handleCopy(item)} />
                <Button icon={<EditOutlined />} onClick={() => openEdit(item)} />
                <Popconfirm title="删除这条书摘？" onConfirm={() => handleDelete(item.id)}>
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </article>
          ))}
        </div>
      )}

      <Modal
        title={editing ? '编辑书摘' : '新增书摘'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="bookTitle" label="书名" rules={[{ required: true, message: '请输入书名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="author" label="作者">
            <Input />
          </Form.Item>
          <Form.Item name="content" label="摘录" rules={[{ required: true, message: '请输入摘录' }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="note" label="个人评论">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <SelectTags />
          </Form.Item>
          <div className="reading-form-grid">
            <Form.Item name="chapter" label="章节">
              <Input />
            </Form.Item>
            <Form.Item name="pageNo" label="页码">
              <Input />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </section>
  )
}

function SelectTags({ value, onChange }: { value?: string[], onChange?: (value: string[]) => void }) {
  const [text, setText] = useState('')
  const tags = value ?? []

  const addTag = () => {
    const next = text.trim()
    if (!next) {
      return
    }
    onChange?.([...new Set([...tags, next])])
    setText('')
  }

  return (
    <div className="tag-editor">
      <div>
        {tags.map(tag => (
          <Tag key={tag} closable onClose={() => onChange?.(tags.filter(item => item !== tag))}>
            {tag}
          </Tag>
        ))}
      </div>
      <Input
        value={text}
        placeholder="输入标签后回车"
        onChange={event => setText(event.target.value)}
        onPressEnter={addTag}
        onBlur={addTag}
      />
    </div>
  )
}

function downloadMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
