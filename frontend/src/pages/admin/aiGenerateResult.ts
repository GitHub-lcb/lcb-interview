type StreamResultStatus = 'completed' | 'failed' | string

export interface StreamResultItem {
  current?: number
  status?: StreamResultStatus
  questionId?: number
  title?: string
  error?: string
  qualityScore?: number
  qualityIssues?: string[]
}

export interface StreamResultMeta {
  title: string
  qualityText: string
  qualityColor: 'green' | 'orange' | 'red' | 'default'
  detail: string
}

export function getStreamResultMeta(item: StreamResultItem): StreamResultMeta {
  const title = item.title
    || (item.questionId ? `题目 ID: ${item.questionId}` : `第 ${item.current ?? '-'} 题`)
  const qualityText = typeof item.qualityScore === 'number' ? `质量 ${item.qualityScore}` : ''
  const qualityColor = qualityColorOf(item.qualityScore)
  const detailParts = [
    item.error,
    item.qualityIssues?.length ? item.qualityIssues.join('；') : '',
  ].filter(Boolean)

  return {
    title,
    qualityText,
    qualityColor,
    detail: detailParts.join('；'),
  }
}

function qualityColorOf(score?: number): StreamResultMeta['qualityColor'] {
  if (typeof score !== 'number') {
    return 'default'
  }
  if (score >= 85) {
    return 'green'
  }
  if (score >= 60) {
    return 'orange'
  }
  return 'red'
}
