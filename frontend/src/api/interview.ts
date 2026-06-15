import axios from 'axios'
import type { InterviewFeedback, PracticeQueueItem, QuestionSnapshot } from '../types'

export interface InterviewEvaluateRequest {
  questionTitle: string
  categoryName: string
  tags: string[]
  difficulty: string
  targetRole: string
  answer: string
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export function buildInterviewEvaluateRequest(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  targetRole: string,
): InterviewEvaluateRequest {
  return {
    questionTitle: question.title,
    categoryName: question.categoryName,
    tags: question.tags,
    difficulty: question.difficulty,
    targetRole,
    answer: answer.trim(),
  }
}

export async function evaluateInterviewAnswerRemote(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  targetRole: string,
): Promise<InterviewFeedback> {
  const response = await axios.post<ApiResponse<InterviewFeedback>>(
    '/api/interview/evaluate',
    buildInterviewEvaluateRequest(question, answer, targetRole),
    { timeout: 8000 },
  )
  if (response.data.code !== 200) {
    throw new Error(response.data.message || 'Interview evaluation failed')
  }
  return response.data.data
}
