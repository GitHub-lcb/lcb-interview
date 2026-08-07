import api from './index'
import type { KnowledgePointVO, PageResult, Question } from '../types'

export const getHotKnowledgePoints = (category?: number, size = 50) =>
  api.get<{ data: KnowledgePointVO[] }>('/knowledge-points/hot', {
    params: { category, size },
  })
    .then(res => res.data.data)

export const getKnowledgePointQuestions = (pointId: number, page = 0, size = 20) =>
  api.get<{ data: PageResult<Question> }>(`/knowledge-points/${pointId}/questions`, {
    params: { page, size },
  })
    .then(res => res.data.data)
