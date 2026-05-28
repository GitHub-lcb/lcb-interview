import { useEffect, useState } from 'react'
import { Table, Button, Modal, Tag, message, Space } from 'antd'
import { listDrafts, getDraft, approveDraft, rejectDraft } from '../../api/admin'
import ContentView from '../QuestionDetail/ContentView'
import type { QuestionAdmin } from '../../types'
import type { ColumnsType } from 'antd/es/table'

export default function DraftReview() {
  const [data, setData] = useState<QuestionAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<QuestionAdmin | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = (p: number) => {
    setLoading(true)
    listDrafts(p).then(res => {
      setData(res.content as QuestionAdmin[])
      setTotal(res.total)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load(0) }, [])

  const handleApprove = async (id: number) => {
    try {
      await approveDraft(id)
      message.success('已通过')
      load(page)
    } catch { message.error('操作失败') }
  }

  const handleReject = async (id: number) => {
    try {
      await rejectDraft(id)
      message.success('已驳回')
      load(page)
    } catch { message.error('操作失败') }
  }

  const handlePreview = async (id: number) => {
    try {
      const q = await getDraft(id)
      setPreview(q)
      setPreviewOpen(true)
    } catch { message.error('加载失败') }
  }

  const columns: ColumnsType<QuestionAdmin> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '难度', dataIndex: 'difficulty', width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '来源', dataIndex: 'source', width: 100 },
    { title: '创建时间', dataIndex: 'createTime', width: 160 },
    {
      title: '操作', width: 200,
      render: (_: any, r: QuestionAdmin) => (
        <Space>
          <Button size="small" onClick={() => handlePreview(r.id)}>预览</Button>
          <Button size="small" type="primary" onClick={() => handleApprove(r.id)}>通过</Button>
          <Button size="small" danger onClick={() => handleReject(r.id)}>驳回</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ current: page + 1, total, onChange: p => { setPage(p - 1); load(p - 1) }}}
      />
      <Modal title="草稿预览" open={previewOpen} onCancel={() => setPreviewOpen(false)}
             width={800} footer={null}>
        {preview && <ContentView question={preview} defaultOpen />}
      </Modal>
    </>
  )
}
