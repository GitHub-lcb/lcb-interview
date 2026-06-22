import type {
  InterviewCriterion,
  InterviewFeedback,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'

const STOP_WORDS = new Set([
  'and',
  'the',
  'with',
  'for',
  'why',
  'what',
  'how',
  'java',
  'mechanism',
])

export function evaluateInterviewAnswer(
  question: PracticeQueueItem | QuestionSnapshot,
  rawAnswer: string,
): InterviewFeedback {
  const answer = rawAnswer.trim()
  if (!answer) {
    return {
      score: 0,
      level: 'needs-work',
      criteria: [
        criterion('coverage', 0, '还没有覆盖题目核心关键词'),
        criterion('structure', 0, '还没有形成回答结构'),
        criterion('specificity', 0, '还没有给出场景或例子'),
        criterion('risk', 0, '还没有说明边界和风险'),
      ],
      advice: ['先写出核心结论，再补原因、例子和边界。'],
      followUps: [
        `请先用一句话回答：${question.title}`,
        '如果面试官追问线上场景，你会怎么展开？',
      ],
    }
  }

  const normalized = normalize(answer)
  const coverageScore = scoreCoverage(question, normalized)
  const structureScore = scoreStructure(answer)
  const specificityScore = scoreSpecificity(normalized)
  const riskScore = scoreRisk(normalized)
  const baseScore = Math.round(
    coverageScore * 0.35
    + structureScore * 0.25
    + specificityScore * 0.2
    + riskScore * 0.2,
  )
  const depthBonus = answer.length >= 180
    && structureScore >= 70
    && specificityScore >= 70
    && riskScore >= 70
    ? 5
    : 0
  const score = clampScore(baseScore + depthBonus)
  const criteria = [
    criterion('coverage', coverageScore, coverageScore >= 70 ? '核心概念覆盖较完整' : '核心概念还需要补齐'),
    criterion('structure', structureScore, structureScore >= 70 ? '回答有清晰层次' : '建议按结论、原因、例子组织'),
    criterion('specificity', specificityScore, specificityScore >= 70 ? '有具体场景或替代方案' : '缺少项目场景或落地例子'),
    criterion('risk', riskScore, riskScore >= 70 ? '能说明边界和风险' : '需要补充适用边界和误区'),
  ]

  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria,
    advice: buildAdvice(criteria),
    followUps: buildFollowUps(question, criteria),
  }
}

function criterion(key: InterviewCriterion['key'], score: number, summary: string): InterviewCriterion {
  const labels: Record<InterviewCriterion['key'], string> = {
    coverage: '知识覆盖',
    structure: '表达结构',
    specificity: '场景细节',
    risk: '边界风险',
  }
  return {
    key,
    label: labels[key],
    score,
    summary,
  }
}

function scoreCoverage(question: PracticeQueueItem | QuestionSnapshot, normalizedAnswer: string): number {
  const keywords = extractKeywords(question)
  if (keywords.length === 0) {
    return 60
  }
  const matched = keywords.filter(keyword => normalizedAnswer.includes(keyword)).length
  return clampScore(Math.round((matched / keywords.length) * 100))
}

function scoreStructure(answer: string): number {
  const markers = ['首先', '其次', '然后', '最后', '第一', '第二', '1.', '2.', '\n', '结论']
  const markerHits = markers.filter(marker => answer.includes(marker)).length
  const lengthBonus = answer.length >= 120 ? 40 : answer.length >= 60 ? 20 : 0
  return clampScore(markerHits * 22 + lengthBonus)
}

function scoreSpecificity(normalizedAnswer: string): number {
  const markers = ['例如', '比如', '项目', '线上', '生产', '高并发', 'concurrenthashmap', '加锁', 'lock', 'case']
  return clampScore(markers.filter(marker => normalizedAnswer.includes(marker)).length * 28)
}

function scoreRisk(normalizedAnswer: string): number {
  const markers = ['风险', '边界', '缺点', '注意', '不能', '只读', '可见性', '覆盖', '异常', '误区']
  return clampScore(markers.filter(marker => normalizedAnswer.includes(marker)).length * 24)
}

function buildAdvice(criteria: InterviewCriterion[]): string[] {
  return criteria
    .filter(item => item.score < 70)
    .map(item => {
      if (item.key === 'coverage') {
        return '先补齐题目关键词，至少覆盖定义、原因和替代方案。'
      }
      if (item.key === 'structure') {
        return '按“结论 -> 原因 -> 场景 -> 边界”重组答案。'
      }
      if (item.key === 'specificity') {
        return '加入一个线上或项目场景，让答案从背诵变成经验。'
      }
      return '补充适用边界、风险和常见误区。'
    })
}

function buildFollowUps(
  question: PracticeQueueItem | QuestionSnapshot,
  criteria: InterviewCriterion[],
): string[] {
  const normalizedTitle = normalize(question.title)
  const prompts: string[] = []
  if (normalizedTitle.includes('hashmap')) {
    prompts.push('如果换成 ConcurrentHashMap，它解决了哪些并发问题？')
  }
  if (criteria.some(item => item.key === 'specificity' && item.score < 70)) {
    prompts.push('放到线上高并发写入场景，你会怎么选型和验证？')
  }
  if (criteria.some(item => item.key === 'risk' && item.score < 70)) {
    prompts.push('这个方案的边界、风险和常见误区是什么？')
  }
  prompts.push(`请用 60 秒重新回答：${question.title}`)
  return [...new Set(prompts)].slice(0, 3)
}

function extractKeywords(question: PracticeQueueItem | QuestionSnapshot): string[] {
  const text = [question.title, question.categoryName, ...question.tags].join(' ')
  return [...new Set(
    normalize(text)
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .map(word => word.trim())
      .filter(word => word.length >= 3 && !STOP_WORDS.has(word)),
  )].slice(0, 8)
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ')
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}
