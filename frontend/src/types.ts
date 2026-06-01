export interface Category {
  id: number
  name: string
  icon: string
  description: string
  sortOrder: number
}

export interface Tag {
  id: number
  name: string
}

export interface Question {
  id: number
  title: string
  summary?: string
  content: string
  principle?: string
  comparison?: string
  scenario?: string
  risk?: string
  projectExp?: string
  codeExamples?: string
  diagrams?: string
  relatedIds?: string
  difficulty: string
  categoryName: string
  tags: string[]
  viewCount: number
  createTime: string
}

export interface QuestionAdmin extends Question {
  status: 'DRAFT' | 'PUBLISHED' | 'REJECTED'
  source: 'AI_GENERATED' | 'MANUAL'
}

export interface CodeExample {
  lang: string
  title: string
  code: string
  description: string
}

export interface Diagram {
  type: 'mermaid' | 'svg' | 'url'
  alt: string
  content: string
  caption: string
}

export interface BatchProgress {
  status: 'RUNNING' | 'IDLE'
  totalCategories: number
  completedCategories: number
  totalQuestions: number
  generatedQuestions: number
  failedCategories: number
  currentCategory: string | null
  currentMessage: string | null
  errors: string[]
}

export interface GenerationTask {
  taskId: number
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  total: number
  successCount: number
  failCount: number
  message: string
  errors: string[]
  generatedIds: number[]
}

export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  total: number
  totalPages: number
}
