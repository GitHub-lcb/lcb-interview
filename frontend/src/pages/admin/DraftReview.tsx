import { useCallback, useEffect, useMemo, useState } from 'react'
import { Table, Button, Modal, Tag, Space, Alert, Select, Input, Checkbox } from 'antd'
import { emitFeedbackError, emitFeedbackSuccess, emitFeedbackWarning } from '../../utils/feedbackMessage'
import { useSearchParams } from 'react-router-dom'
import { listDrafts, getDraft, approveDraft, rejectDraft, batchApproveDrafts, batchRejectDrafts } from '../../api/admin'
import ContentView from '../QuestionDetail/ContentView'
import { getDraftQualityWarnings } from './draftQuality'
import type { DraftContentStatus, DraftReviewFilters, DraftRiskType, QuestionAdmin } from '../../types'
import type { ColumnsType } from 'antd/es/table'

type RejectTarget =
  | { kind: 'single'; id: number; title: string }
  | { kind: 'batch'; ids: number[] }

const riskOptions: { label: string; value: DraftRiskType }[] = [
  { label: '空答案', value: 'EMPTY_ANSWER' },
  { label: '短答案', value: 'SHORT_ANSWER' },
  { label: '缺摘要', value: 'MISSING_SUMMARY' },
  { label: '缺原理', value: 'MISSING_PRINCIPLE' },
  { label: '缺对比', value: 'MISSING_COMPARISON' },
  { label: '缺场景', value: 'MISSING_SCENARIO' },
  { label: '缺风险', value: 'MISSING_RISK' },
  { label: '缺项目', value: 'MISSING_PROJECT_EXP' },
  { label: '缺代码', value: 'MISSING_CODE_EXAMPLES' },
  { label: '缺结构段', value: 'MISSING_CONTENT_SECTIONS' },
  { label: '难度异常', value: 'INVALID_DIFFICULTY' },
]

const contentStatusOptions: { label: string; value: DraftContentStatus }[] = [
  { label: '无答案内容', value: 'EMPTY' },
  { label: '有答案内容', value: 'WITH_CONTENT' },
]

export default function DraftReview() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<QuestionAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [preview, setPreview] = useState<QuestionAdmin | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null)
  const [rejectClearContent, setRejectClearContent] = useState(false)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [riskType, setRiskType] = useState<DraftRiskType | undefined>(() =>
    normalizeRiskType(searchParams.get('risk'))
  )
  const [contentStatus, setContentStatus] = useState<DraftContentStatus | undefined>(() =>
    normalizeContentStatus(searchParams.get('contentStatus'))
  )
  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') || '')
  const [categoryId] = useState(() => {
    const value = Number(searchParams.get('categoryId'))
    return Number.isFinite(value) && value > 0 ? value : undefined
  })

  const filters = useMemo(
    () => buildDraftFilters(riskType, contentStatus, keyword, categoryId),
    [riskType, contentStatus, keyword, categoryId],
  )

  const load = useCallback((p: number) => {
    setLoading(true)
    setLoadError(false)
    listDrafts(p, 20, filters, { silentGlobalError: true }).then((res: any) => {
      setData((res.records || res.content) as QuestionAdmin[])
      setTotal(res.total)
      setLoadError(false)
    }).catch(() => {
      setData([])
      setTotal(0)
      setLoadError(true)
    }).finally(() => {
      setLoading(false)
    })
  }, [filters])

  useEffect(() => { load(0) }, [load])

  const syncSearchParams = (
    nextRiskType: DraftRiskType | undefined,
    nextContentStatus: DraftContentStatus | undefined,
    nextKeyword: string,
  ) => {
    const next = new URLSearchParams()
    if (nextRiskType) { next.set('risk', nextRiskType) }
    if (nextContentStatus) { next.set('contentStatus', nextContentStatus) }
    if (nextKeyword.trim()) { next.set('keyword', nextKeyword.trim()) }
    if (categoryId) { next.set('categoryId', String(categoryId)) }
    setSearchParams(next, { replace: true })
  }

  const handleRiskChange = (value?: DraftRiskType) => {
    setRiskType(value)
    setCurrent(1)
    setSelectedIds([])
    syncSearchParams(value, contentStatus, keyword)
  }

  const handleContentStatusChange = (value?: DraftContentStatus) => {
    setContentStatus(value)
    setCurrent(1)
    setSelectedIds([])
    syncSearchParams(riskType, value, keyword)
  }

  const handleSearch = (value: string) => {
    setKeyword(value)
    setCurrent(1)
    setSelectedIds([])
    syncSearchParams(riskType, contentStatus, value)
  }

  const handleClearFilters = () => {
    setRiskType(undefined)
    setContentStatus(undefined)
    setKeyword('')
    setCurrent(1)
    setSelectedIds([])
    syncSearchParams(undefined, undefined, '')
  }

  const handleApprove = async (id: number) => {
    try { await approveDraft(id); emitFeedbackSuccess('已通过'); load(current - 1) }
    catch (error) { showActionFailure(error, '操作失败') }
  }

  const openSingleReject = (question: QuestionAdmin) => {
    setRejectTarget({ kind: 'single', id: question.id, title: question.title })
    setRejectClearContent(false)
  }

  const closeRejectModal = () => {
    setRejectTarget(null)
    setRejectClearContent(false)
  }

  const handlePreview = async (id: number) => {
    try { const q = await getDraft(id); setPreview(q); setPreviewOpen(true) }
    catch { emitFeedbackError('加载失败') }
  }

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) { emitFeedbackWarning('请先选择题目'); return }
    try {
      await batchApproveDrafts(selectedIds)
      emitFeedbackSuccess(`已通过 ${selectedIds.length} 道题`)
      setSelectedIds([]); load(current - 1)
    } catch (error) { showActionFailure(error, '批量操作失败') }
  }

  const handleBatchReject = async () => {
    if (selectedIds.length === 0) { emitFeedbackWarning('请先选择题目'); return }
    setRejectTarget({ kind: 'batch', ids: selectedIds })
    setRejectClearContent(false)
  }

  const handleConfirmReject = async () => {
    if (!rejectTarget) { return }
    setRejectSubmitting(true)
    try {
      if (rejectTarget.kind === 'single') {
        await rejectDraft(rejectTarget.id, { clearContent: rejectClearContent })
        emitFeedbackSuccess(rejectClearContent ? '已清空答案，等待重新补答案' : '已驳回')
      } else {
        await batchRejectDrafts(rejectTarget.ids, { clearContent: rejectClearContent })
        emitFeedbackSuccess(rejectClearContent
          ? `已清空 ${rejectTarget.ids.length} 道题答案`
          : `已驳回 ${rejectTarget.ids.length} 道题`)
        setSelectedIds([])
      }
      closeRejectModal()
      load(current - 1)
    } catch (error) {
      showActionFailure(error, rejectTarget.kind === 'batch' ? '批量操作失败' : '操作失败')
    } finally {
      setRejectSubmitting(false)
    }
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
    {
      title: '质量',
      width: 230,
      render: (_: any, r: QuestionAdmin) => <Space wrap size={[4, 4]}>{renderQualityTags(r)}</Space>,
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
          <Button size="small" danger onClick={() => openSingleReject(r)}>驳回</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          allowClear
          placeholder="答案内容"
          style={{ width: 140 }}
          options={contentStatusOptions}
          value={contentStatus}
          onChange={handleContentStatusChange}
        />
        <Select
          allowClear
          placeholder="质量风险"
          style={{ width: 160 }}
          options={riskOptions}
          value={riskType}
          onChange={handleRiskChange}
        />
        <Input.Search
          allowClear
          placeholder="搜索标题/摘要"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={handleSearch}
          style={{ width: 240 }}
        />
        {(riskType || contentStatus || keyword || categoryId) && (
          <Button onClick={handleClearFilters}>清空筛选</Button>
        )}
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
      {loadError && (
        <Alert
          type="error"
          showIcon
          message="草稿列表加载失败"
          description="当前筛选条件下的草稿暂时无法加载，重试后会按当前筛选条件重新获取列表。"
          action={<Button size="small" loading={loading} onClick={() => load(current - 1)}>重试</Button>}
          style={{ marginBottom: 12 }}
        />
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
      <Modal
        title={rejectTarget?.kind === 'batch' ? `驳回 ${rejectTarget.ids.length} 道草稿` : '驳回草稿'}
        open={!!rejectTarget}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        confirmLoading={rejectSubmitting}
        onOk={handleConfirmReject}
        onCancel={closeRejectModal}
      >
        <Space direction="vertical" size={12}>
          {rejectTarget?.kind === 'single' && <span>{rejectTarget.title}</span>}
          <Checkbox
            checked={rejectClearContent}
            onChange={event => setRejectClearContent(event.target.checked)}
          >
            清空答案并重新补
          </Checkbox>
          {rejectClearContent && (
            <Alert
              type="info"
              showIcon
              message="清空后保留题目，状态保持草稿，可被流式补答案重新生成内容。"
            />
          )}
        </Space>
      </Modal>
    </>
  )
}

function buildDraftFilters(
  riskType: DraftRiskType | undefined,
  contentStatus: DraftContentStatus | undefined,
  keyword: string,
  categoryId?: number,
): DraftReviewFilters {
  const filters: DraftReviewFilters = {}
  if (riskType) { filters.riskType = riskType }
  if (contentStatus) { filters.contentStatus = contentStatus }
  if (keyword.trim()) { filters.keyword = keyword.trim() }
  if (categoryId) { filters.categoryId = categoryId }
  return filters
}

function normalizeRiskType(value: string | null): DraftRiskType | undefined {
  return riskOptions.some(option => option.value === value) ? value as DraftRiskType : undefined
}

function normalizeContentStatus(value: string | null): DraftContentStatus | undefined {
  return contentStatusOptions.some(option => option.value === value) ? value as DraftContentStatus : undefined
}

function renderQualityTags(question: QuestionAdmin) {
  const warnings = getDraftQualityWarnings(question)

  if (warnings.length === 0) {
    return <Tag color="success">完整</Tag>
  }
  const visibleWarnings = warnings.slice(0, 5)
  return [
    ...visibleWarnings.map(warning => (
      <Tag key={warning.label} color={warning.color}>{warning.label}</Tag>
    )),
    warnings.length > visibleWarnings.length
      ? <Tag key="more" color="default">+{warnings.length - visibleWarnings.length}</Tag>
      : null,
  ]
}

function showActionFailure(error: unknown, fallback: string) {
  // Axios 拦截器已经展示后端业务错误，这里只兜底非标准异常，避免覆盖具体原因。
  if (error instanceof Error && error.message) {
    return
  }
  emitFeedbackError(fallback)
}
