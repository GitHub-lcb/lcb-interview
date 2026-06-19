import { useCallback, useEffect, useState } from 'react'
import { Table, Button, Modal, Tag, message, Space, Alert } from 'antd'
import { listDrafts, getDraft, approveDraft, rejectDraft, batchApproveDrafts, batchRejectDrafts } from '../../api/admin'
import ContentView from '../QuestionDetail/ContentView'
import type { QuestionAdmin } from '../../types'
import type { ColumnsType } from 'antd/es/table'

export default function DraftReview() {
  const [data, setData] = useState<QuestionAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(1)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<QuestionAdmin | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const load = useCallback((p: number) => {
    setLoading(true)
    listDrafts(p).then((res: any) => {
      setData((res.records || res.content) as QuestionAdmin[])
      setTotal(res.total)
      setLoading(false)
    }).catch(() => { setLoading(false); setData([]) })
  }, [])

  useEffect(() => { load(0) }, [load])

  const handleApprove = async (id: number) => {
    try { await approveDraft(id); message.success('已通过'); load(current - 1) }
    catch { message.error('操作失败') }
  }

  const handleReject = async (id: number) => {
    try { await rejectDraft(id); message.success('已驳回'); load(current - 1) }
    catch { message.error('操作失败') }
  }

  const handlePreview = async (id: number) => {
    try { const q = await getDraft(id); setPreview(q); setPreviewOpen(true) }
    catch { message.error('加载失败') }
  }

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) { message.warning('请先选择题目'); return }
    try {
      await batchApproveDrafts(selectedIds)
      message.success(`已通过 ${selectedIds.length} 道题`)
      setSelectedIds([]); load(current - 1)
    } catch { message.error('批量操作失败') }
  }

  const handleBatchReject = async () => {
    if (selectedIds.length === 0) { message.warning('请先选择题目'); return }
    try {
      await batchRejectDrafts(selectedIds)
      message.success(`已驳回 ${selectedIds.length} 道题`)
      setSelectedIds([]); load(current - 1)
    } catch { message.error('批量操作失败') }
  }

  const handlePageChange = (p: number) => {
    setCurrent(p)
    setSelectedIds([])
    load(p - 1)
  }

  const columns: ColumnsType<QuestionAdmin> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', ellipsis: true, width: 240 },
    {
      title: '摘要', dataIndex: 'summary', width: 300, ellipsis: true,
      render: (_: any, r: QuestionAdmin) => {
        const txt = r.summary || (r.content || r.answer || '').replace(/<[^>]*>/g, '').replace(/```[\s\S]*?```/g, '').slice(0, 120)
        return txt ? <span style={{ color: '#71717A', fontSize: 13 }}>{txt}...</span> : <Tag color="warning">无内容</Tag>
      },
    },
    { title: '难度', dataIndex: 'difficulty', width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '来源', dataIndex: 'source', width: 90 },
    { title: '创建时间', dataIndex: 'createTime', width: 155 },
    {
      title: '操作', width: 210, fixed: 'right',
      render: (_: any, r: QuestionAdmin) => (
        <Space wrap>
          <Button size="small" onClick={() => handlePreview(r.id)}>预览</Button>
          <Button size="small" type="primary" onClick={() => handleApprove(r.id)}>通过</Button>
          <Button size="small" danger onClick={() => handleReject(r.id)}>驳回</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <span>已选 {selectedIds.length} 题</span>
        <Button type="primary" onClick={handleBatchApprove}
                disabled={selectedIds.length === 0}>批量通过</Button>
        <Button danger onClick={handleBatchReject}
                disabled={selectedIds.length === 0}>批量驳回</Button>
      </Space>
      {selectedIds.length > 50 && (
        <Alert type="warning" showIcon message={`已选 ${selectedIds.length} 题，批量操作可能较慢`}
               style={{ marginBottom: 12 }} />
      )}
      <Table
        rowKey="id"
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current, total, pageSize: 20, showSizeChanger: false,
          onChange: handlePageChange,
        }}
      />
      <Modal title="草稿预览" open={previewOpen} onCancel={() => setPreviewOpen(false)}
             width={800} footer={null}
             styles={{ body: { overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' } }}>
        {preview && <ContentView question={preview} defaultOpen />}
      </Modal>
    </>
  )
}
