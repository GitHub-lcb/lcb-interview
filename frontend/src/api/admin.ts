import type { AxiosRequestConfig } from 'axios'
import api from './index'

export const batchGenerate = (params: {
  countPerCategory?: number
  categoryName?: string
  delaySeconds?: number
}) =>
  api.post<{ data: string }>('/admin/ai/batch', params)
    .then(res => res.data.data)

export const getBatchStatus = () =>
  api.get<{ data: import('../types').BatchProgress }>('/admin/ai/batch/status')
    .then(res => res.data.data)

export const getAdminQualitySummary = (options: AxiosRequestConfig = {}) =>
  api.get<{ data: import('../types').AdminQualitySummary }>('/admin/dashboard/quality-summary', options)
    .then(res => res.data.data)

export const listDrafts = (
  page = 0,
  size = 20,
  filters: import('../types').DraftReviewFilters = {},
  options: AxiosRequestConfig = {},
) =>
  api.get<{ data: { records: import('../types').QuestionAdmin[], total: number, current: number, pages: number } }>(
    '/admin/questions/draft',
    {
      ...options,
      params: {
        page,
        size,
        ...filters,
        ...options.params,
      },
    },
  )
    .then(res => res.data.data)

export const getDraft = (id: number) =>
  api.get<{ data: import('../types').QuestionAdmin }>(`/admin/questions/draft/${id}`)
    .then(res => res.data.data)

export const updateDraft = (id: number, data: Partial<import('../types').QuestionAdmin>) =>
  api.put(`/admin/questions/draft/${id}`, data)

export const approveDraft = (id: number) =>
  api.post(`/admin/questions/draft/${id}/approve`)

export const rejectDraft = (id: number) =>
  api.post(`/admin/questions/draft/${id}/reject`)

export const batchApproveDrafts = (ids: number[]) =>
  api.post('/admin/questions/draft/batch-approve', ids)

export const batchRejectDrafts = (ids: number[]) =>
  api.post('/admin/questions/draft/batch-reject', ids)

/**
 * SSE 流式生成单道题。
 * 返回一个 AbortController，可用于取消连接。
 * onEvent 接收事件类型和数据的回调。
 */
export function streamGenerate(
  params: { category: string; difficulty?: string; count?: number; topic?: string },
  onEvent: (event: import('../types').StreamEvent) => void
): AbortController {
  const baseUrl = window.location.origin
  const query = new URLSearchParams()
  query.set('category', params.category)
  if (params.difficulty) query.set('difficulty', params.difficulty)
  if (params.count) query.set('count', String(params.count))
  if (params.topic) query.set('topic', params.topic)
  // EventSource 不支持自定义请求头，通过查询参数传递 token
  const token = localStorage.getItem('adminToken')
  if (token) query.set('token', token)

  const abort = new AbortController()
  const es = new EventSource(`${baseUrl}/api/admin/ai/generate-stream?${query}`)

  es.addEventListener('thinking', (e: MessageEvent) => onEvent({ type: 'thinking', data: e.data }))
  es.addEventListener('content', (e: MessageEvent) => onEvent({ type: 'content', data: e.data }))
  es.addEventListener('progress', (e: MessageEvent) => onEvent({ type: 'progress', data: e.data }))
  es.addEventListener('question_result', (e: MessageEvent) => onEvent({ type: 'question_result', data: e.data }))
  es.addEventListener('done', (e: MessageEvent) => { onEvent({ type: 'done', data: e.data }); es.close() })
  es.addEventListener('error', (e: MessageEvent) => { onEvent({ type: 'error', data: e.data || '连接错误' }); es.close() })
  es.addEventListener('info', (e: MessageEvent) => onEvent({ type: 'info', data: e.data }))

  es.onerror = () => { onEvent({ type: 'error', data: '连接中断' }); es.close() }

  // 关联 abort
  ;(abort as any).__es = es
  const origAbort = abort.abort.bind(abort)
  abort.abort = () => { es.close(); origAbort() }

  return abort
}

/**
 * SSE 流式补答案（逐题发送，实时进度）。
 */
export function streamFillAnswer(
  onEvent: (event: import('../types').StreamEvent) => void,
  categoryId?: number,
  count: number = 5
): AbortController {
  const baseUrl = window.location.origin
  const params = new URLSearchParams()
  if (categoryId) params.set('categoryId', String(categoryId))
  params.set('count', String(count))
  const token = localStorage.getItem('adminToken')
  if (token) params.set('token', token)

  const abort = new AbortController()
  const es = new EventSource(`${baseUrl}/api/admin/ai/fill-answer-stream?${params}`)

  es.addEventListener('thinking', (e: MessageEvent) => onEvent({ type: 'thinking', data: e.data }))
  es.addEventListener('content', (e: MessageEvent) => onEvent({ type: 'content', data: e.data }))
  es.addEventListener('progress', (e: MessageEvent) => onEvent({ type: 'progress', data: e.data }))
  es.addEventListener('question_result', (e: MessageEvent) => onEvent({ type: 'question_result', data: e.data }))
  es.addEventListener('total', (e: MessageEvent) => onEvent({ type: 'total', data: e.data }))
  es.addEventListener('done', (e: MessageEvent) => { onEvent({ type: 'done', data: e.data }); es.close() })
  es.addEventListener('error', (e: MessageEvent) => { onEvent({ type: 'error', data: e.data || '连接错误' }); es.close() })
  es.addEventListener('info', (e: MessageEvent) => onEvent({ type: 'info', data: e.data }))

  es.onerror = () => { onEvent({ type: 'error', data: '连接中断' }); es.close() }

  ;(abort as any).__es = es
  const origAbort = abort.abort.bind(abort)
  abort.abort = () => { es.close(); origAbort() }

  return abort
}

/**
 * SSE 流式重写已发布题目答案（结果进入草稿审核）。
 */
export function streamRewritePublishedAnswers(
  onEvent: (event: import('../types').StreamEvent) => void,
  categoryId?: number,
  keyword?: string,
  count: number = 5
): AbortController {
  const baseUrl = window.location.origin
  const params = new URLSearchParams()
  if (categoryId) params.set('categoryId', String(categoryId))
  if (keyword?.trim()) params.set('keyword', keyword.trim())
  params.set('count', String(count))
  const token = localStorage.getItem('adminToken')
  if (token) params.set('token', token)

  const abort = new AbortController()
  const es = new EventSource(`${baseUrl}/api/admin/ai/rewrite-published-stream?${params}`)

  es.addEventListener('thinking', (e: MessageEvent) => onEvent({ type: 'thinking', data: e.data }))
  es.addEventListener('content', (e: MessageEvent) => onEvent({ type: 'content', data: e.data }))
  es.addEventListener('progress', (e: MessageEvent) => onEvent({ type: 'progress', data: e.data }))
  es.addEventListener('question_result', (e: MessageEvent) => onEvent({ type: 'question_result', data: e.data }))
  es.addEventListener('total', (e: MessageEvent) => onEvent({ type: 'total', data: e.data }))
  es.addEventListener('done', (e: MessageEvent) => { onEvent({ type: 'done', data: e.data }); es.close() })
  es.addEventListener('error', (e: MessageEvent) => { onEvent({ type: 'error', data: e.data || '连接错误' }); es.close() })
  es.addEventListener('info', (e: MessageEvent) => onEvent({ type: 'info', data: e.data }))

  es.onerror = () => { onEvent({ type: 'error', data: '连接中断' }); es.close() }

  ;(abort as any).__es = es
  const origAbort = abort.abort.bind(abort)
  abort.abort = () => { es.close(); origAbort() }

  return abort
}
