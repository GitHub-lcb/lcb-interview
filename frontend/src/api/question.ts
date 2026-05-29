import api from './index'
import { Question, PageResult } from '../types'

export interface QuestionQuery {
  category?: number
  difficulty?: string
  keyword?: string
  tag?: number
  page?: number
  size?: number
}

export const getQuestions = (params: QuestionQuery) =>
  api.get<{ data: PageResult<Question> }>('/questions', { params })
    .then(res => res.data.data)

export const getQuestionById = (id: number) =>
  api.get<{ data: Question }>(`/questions/${id}`).then(res => res.data.data)

export const getHotQuestions = (size = 10) =>
  api.get<{ data: Question[] }>('/questions/hot', { params: { size } })
    .then(res => res.data.data)
