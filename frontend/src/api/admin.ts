import api from './index'

export const generateQuestions = (params: {
  category: string
  difficulty?: string
  count: number
  topic?: string
}) =>
  api.post<{ data: number }>('/admin/ai/generate', params)
    .then(res => res.data.data)

export const getGenerationTask = (taskId: number) =>
  api.get<{ data: import('../types').GenerationTask }>(`/admin/ai/tasks/${taskId}`)
    .then(res => res.data.data)

export const listDrafts = (page = 0, size = 20) =>
  api.get<{ data: import('../types').PageResult<import('../types').QuestionAdmin> }>('/admin/questions/draft', { params: { page, size } })
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
