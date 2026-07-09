import api from './index'
import type {
  LotteryKl8Draw,
  LotteryKl8Recommendation,
  LotteryKl8SyncResult,
  LotteryKl8SyncStatus,
  MarkdownExport,
  PageResult,
  ReadingExcerpt,
  ReadingExcerptPayload,
} from '../types'

const KL8_RECOMMENDATION_TIMEOUT_MS = 120000
const KL8_SYNC_TIMEOUT_MS = 120000

export interface ReadingExcerptListParams {
  page?: number
  size?: number
  keyword?: string
  tag?: string
  bookTitle?: string
}

export async function listReadingExcerpts(params: ReadingExcerptListParams): Promise<PageResult<ReadingExcerpt>> {
  const res = await api.get('/tools/reading/excerpts', { params })
  return res.data.data
}

export async function createReadingExcerpt(payload: ReadingExcerptPayload): Promise<ReadingExcerpt> {
  const res = await api.post('/tools/reading/excerpts', payload)
  return res.data.data
}

export async function updateReadingExcerpt(id: number, payload: ReadingExcerptPayload): Promise<ReadingExcerpt> {
  const res = await api.put(`/tools/reading/excerpts/${id}`, payload)
  return res.data.data
}

export async function deleteReadingExcerpt(id: number): Promise<void> {
  await api.delete(`/tools/reading/excerpts/${id}`)
}

export async function exportReadingExcerpts(params: ReadingExcerptListParams): Promise<MarkdownExport> {
  const res = await api.get('/tools/reading/excerpts/export', { params })
  return res.data.data
}

export async function syncKl8Draws(): Promise<LotteryKl8SyncResult> {
  const res = await api.post('/tools/lottery/kl8/sync', undefined, { timeout: KL8_SYNC_TIMEOUT_MS })
  return res.data.data
}

export async function getKl8SyncStatus(): Promise<LotteryKl8SyncStatus> {
  const res = await api.get('/tools/lottery/kl8/sync-status')
  return res.data.data
}

export async function listKl8Draws(page = 0, size = 30): Promise<PageResult<LotteryKl8Draw>> {
  const res = await api.get('/tools/lottery/kl8/draws', { params: { page, size } })
  return res.data.data
}

export async function createKl8Recommendation(baseIssueCount = 2000, pickSize = 5): Promise<LotteryKl8Recommendation> {
  const res = await api.post('/tools/lottery/kl8/recommendations', { baseIssueCount, pickSize }, {
    timeout: KL8_RECOMMENDATION_TIMEOUT_MS,
  })
  return res.data.data
}

export async function listKl8Recommendations(page = 0, size = 10): Promise<PageResult<LotteryKl8Recommendation>> {
  const res = await api.get('/tools/lottery/kl8/recommendations', { params: { page, size } })
  return res.data.data
}
