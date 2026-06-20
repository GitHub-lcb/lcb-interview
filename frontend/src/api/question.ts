import api from './index'
import type { AxiosRequestConfig } from 'axios'
import { Question, PageResult } from '../types'

interface RequestOptions {
  silentGlobalError?: boolean
}

type RawPageResult<T> = Partial<PageResult<T>> & {
  records?: T[]
  current?: number
  pages?: number
}

export function normalizePageResult<T>(page?: RawPageResult<T>): PageResult<T> {
  const content = Array.isArray(page?.content)
    ? page.content
    : Array.isArray(page?.records)
      ? page.records
      : []
  const total = Number(page?.total ?? content.length)
  const size = Number(page?.size ?? content.length)
  const currentPage = Number(page?.page ?? page?.current ?? 0)
  const totalPages = Number(page?.totalPages ?? page?.pages ?? (size > 0 ? Math.ceil(total / size) : 0))

  return {
    content,
    page: currentPage,
    size,
    total,
    totalPages,
  }
}

export interface QuestionQuery {
  category?: number
  difficulty?: string
  keyword?: string
  tag?: number
  page?: number
  size?: number
}

export const getQuestions = (params: QuestionQuery, options: AxiosRequestConfig = {}) =>
  api.get<{ data: RawPageResult<Question> }>('/questions', { params, ...options })
    .then(res => normalizePageResult(res.data.data))

export const getQuestionById = (id: number, options: RequestOptions = {}) =>
  api.get<{ data: Question }>(`/questions/${id}`, options).then(res => res.data.data)

export const getHotQuestions = (size = 10, options: RequestOptions = {}) =>
  api.get<{ data: Question[] }>('/questions/hot', { params: { size }, ...options })
    .then(res => res.data.data)
