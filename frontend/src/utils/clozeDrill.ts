import type { Question } from '../types'

/** 挖空默写最多生成的空位数：太多会让评分琐碎，太少达不到默写训练强度。 */
const MAX_BLANKS = 6
/** 一段文本最少需要的字符数，太短的段落挖空没有训练价值。 */
const MIN_TEXT_LENGTH = 30

const STOP_WORDS = new Set([
  '一个', '这个', '那个', '可以', '可能', '需要', '说明', '进行', '时候', '什么',
  '如果', '以及', '还有', '但是', '因此', '所以', '或者', '同时', '另外', '例如',
  '情况', '问题', '方式', '方面', '作用', '不同', '如下', '如下所示',
  'the', 'and', 'with', 'for', 'that', 'this', 'from', 'are', 'will', 'have',
])

export interface ClozeBlank {
  /** 被挖空的原文词。 */
  answer: string
  /** 空位前缀提示（前 8 个字符，仅长词显示）。 */
  hint: string
}

export interface ClozeDrill {
  /** 挖空后的段落文本，空位用 ______（6 个下划线）占位。 */
  maskedText: string
  blanks: ClozeBlank[]
  /** 评分时用的完整原文。 */
  fullText: string
  sourceLabel: string
}

export interface ClozeCheckResult {
  total: number
  correct: number
  score: number
  /** 每个空位的判定详情，wrong 时含用户输入。 */
  details: Array<{ index: number; expected: string; actual: string; correct: boolean }>
}

/**
 * 从题目结构化字段构造挖空默写材料。
 *
 * 为什么优先 summary：30 秒口径是最需要肌肉记忆的部分，背题场景下先保证
 * 一句话结论能脱口而出；summary 不足时再取 content 开头段落补充。
 */
export function buildClozeDrill(question: Question): ClozeDrill | null {
  const candidates: Array<{ label: string; text: string }> = [
    { label: '30 秒口径', text: question.summary ?? '' },
    { label: '标准回答', text: question.content ?? '' },
  ]
  const usable = candidates.find(candidate => candidate.text.trim().length >= MIN_TEXT_LENGTH)
  if (!usable) {
    return null
  }

  // content 可能是多段长文，挖空训练只取第一段，避免单题材料过长。
  const firstParagraph = splitParagraphs(usable.text)[0] ?? usable.text
  const terms = extractClozeTerms(firstParagraph)
  if (terms.length === 0) {
    return null
  }

  let maskedText = firstParagraph
  const blanks: ClozeBlank[] = []
  for (const term of terms) {
    if (blanks.length >= MAX_BLANKS) {
      break
    }
    // 同词多处出现只挖第一处，其余保留作为上下文线索。
    if (maskedText.includes(term)) {
      maskedText = maskedText.replace(term, '______')
      blanks.push({ answer: term, hint: term.length > 8 ? term.slice(0, 8) : '' })
    }
  }

  if (blanks.length === 0) {
    return null
  }

  return {
    maskedText,
    blanks,
    fullText: firstParagraph,
    sourceLabel: usable.label,
  }
}

/**
 * 判定默写结果：不区分大小写、忽略首尾空格；中文精确匹配，英文允许复数形式差异。
 */
export function checkClozeAnswers(drill: ClozeDrill, answers: string[]): ClozeCheckResult {
  const details = drill.blanks.map((blank, index) => {
    const actual = (answers[index] ?? '').trim()
    const expected = blank.answer
    const correct = actual.length > 0 && matchTerm(expected, actual)
    return { index, expected, actual, correct }
  })
  const correctCount = details.filter(detail => detail.correct).length
  return {
    total: details.length,
    correct: correctCount,
    score: details.length === 0 ? 0 : Math.round((correctCount / details.length) * 100),
    details,
  }
}

function matchTerm(expected: string, actual: string): boolean {
  if (expected.toLowerCase() === actual.toLowerCase()) {
    return true
  }
  // 英文技术词允许复数/单复数互换（如 index/indexes、map/maps），背题时不应因词形扣分。
  if (/^[a-z0-9.+#]+$/i.test(expected) && /^[a-z0-9.+#]+$/i.test(actual)) {
    const singular = (word: string) => word.replace(/(es|s)$/i, '')
    return singular(expected.toLowerCase()) === singular(actual.toLowerCase())
  }
  return false
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
}

/**
 * 提取适合挖空的关键词：英文技术词（含 . # + 等版本/类名符号）和长度 ≥2 的中文词，
 * 剔除停用词；按出现顺序取唯一值，再从中均匀抽样避免空位全挤在开头。
 */
function extractClozeTerms(text: string): string[] {
  const tokens = text
    .replace(/```[\s\S]*?```/g, ' ')
    .match(/[A-Za-z][A-Za-z0-9.+#-]{2,}|[\u4e00-\u9fa5]{2,6}/g) ?? []
  const unique: string[] = []
  for (const token of tokens) {
    if (STOP_WORDS.has(token.toLowerCase()) || STOP_WORDS.has(token)) {
      continue
    }
    if (!unique.includes(token)) {
      unique.push(token)
    }
  }
  if (unique.length <= MAX_BLANKS) {
    return unique
  }
  // 均匀抽样：从头中尾各取一些，保证空位覆盖段落不同位置而不是只挖前几个词。
  const step = unique.length / MAX_BLANKS
  const sampled: string[] = []
  for (let index = 0; index < MAX_BLANKS; index += 1) {
    const term = unique[Math.floor(index * step)]
    if (!sampled.includes(term)) {
      sampled.push(term)
    }
  }
  return sampled
}
