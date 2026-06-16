import api from './index'
import { Question, PageResult } from '../types'

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

export const getQuestions = (params: QuestionQuery) =>
  api.get<{ data: RawPageResult<Question> }>('/questions', { params })
    .then(res => normalizePageResult(res.data.data))

export const getQuestionById = (id: number) =>
  api.get<{ data: Question }>(`/questions/${id}`).then(res => res.data.data)

export const getHotQuestions = (size = 10) =>
  api.get<{ data: Question[] }>('/questions/hot', { params: { size } })
    .then(res => res.data.data)
