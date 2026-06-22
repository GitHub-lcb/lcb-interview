import type { AnswerGapModule, AnswerGapReport, Question } from '../types'

interface GapModuleConfig {
  key: keyof Question
  label: string
  weight: number
  guidance: string
}

const MODULES: GapModuleConfig[] = [
  { key: 'summary', label: '30 秒口径', weight: 12, guidance: '先用一句话给结论，再补核心原因。' },
  { key: 'content', label: '标准回答', weight: 18, guidance: '补齐标准回答里的核心机制和关键名词。' },
  { key: 'principle', label: '原理深挖', weight: 16, guidance: '补底层原理、执行链路或关键数据结构。' },
  { key: 'comparison', label: '对比分析', weight: 10, guidance: '加入替代方案、相似概念或选型对比。' },
  { key: 'scenario', label: '适用场景', weight: 12, guidance: '放到线上/项目场景，说明触发条件和验证动作。' },
  { key: 'risk', label: '风险误区', weight: 16, guidance: '补适用边界、失败场景和常见误区。' },
  { key: 'projectExp', label: '项目落地', weight: 16, guidance: '补项目实践、监控指标、压测或迁移方案。' },
]

const STOP_WORDS = new Set([
  '一个',
  '这个',
  '需要',
  '说明',
  '可以',
  '可能',
  '进行',
  '时候',
  'the',
  'and',
  'with',
])

export function buildAnswerGapReport(question: Question, rawAnswer: string): AnswerGapReport {
  const answer = normalize(rawAnswer)
  const modules = availableModules(question)

  if (!answer) {
    const missingModules = modules.map(module => buildModuleResult(module, 0, 'missing'))
    return {
      score: 0,
      level: 'empty',
      title: '先完成基础回答',
      summary: '回答为空，暂时无法和标准答案校准。',
      modules: missingModules,
      coveredModules: [],
      missingModules,
      rewriteOutline: buildRewriteOutline(missingModules),
    }
  }

  const analyzedModules = modules.map(module => analyzeModule(module, answer))
  const totalWeight = modules.reduce((sum, module) => sum + module.weight, 0)
  const score = totalWeight === 0
    ? 0
    : Math.round(analyzedModules.reduce((sum, module, index) => sum + module.score * modules[index].weight, 0) / totalWeight)
  const missingModules = analyzedModules.filter(module => module.status === 'missing')
  const coveredModules = analyzedModules.filter(module => module.status === 'covered')

  return {
    score,
    level: resolveLevel(score),
    title: resolveTitle(score),
    summary: buildSummary(score, missingModules),
    modules: analyzedModules,
    coveredModules,
    missingModules,
    rewriteOutline: buildRewriteOutline(missingModules.length > 0 ? missingModules : analyzedModules.filter(module => module.status === 'partial')),
  }
}

export function buildAnswerGapMarkdown(
  question: Question,
  rawAnswer: string,
  now = new Date().toISOString(),
): string {
  const report = buildAnswerGapReport(question, rawAnswer)

  return [
    `# ${question.title} 答案差距校准`,
    '',
    `生成时间：${formatDate(now)}`,
    `分类：${question.categoryName}`,
    `难度：${question.difficulty}`,
    '',
    renderSummary(report),
    renderModules(report.modules),
    renderPriorityModules(report.missingModules),
    renderRewriteOutline(report.rewriteOutline),
  ].join('\n')
}

function renderSummary(report: AnswerGapReport): string {
  return [
    '## 校准摘要',
    `- 分数：${report.score}`,
    `- 状态：${report.title}`,
    `- 说明：${report.summary}`,
    '',
  ].join('\n')
}

function renderModules(modules: AnswerGapModule[]): string {
  return [
    '## 模块明细',
    ...modules.map(module => (
      `- ${module.label}：${module.score} 分，${module.status}，${module.evidence}；${module.guidance}`
    )),
    '',
  ].join('\n')
}

function renderPriorityModules(modules: AnswerGapModule[]): string {
  const lines = modules.length > 0
    ? modules.map(module => `- ${module.label}：${module.guidance}`)
    : ['- 暂无缺失模块，继续压缩表达并补项目例子。']

  return [
    '## 优先补齐',
    ...lines,
    '',
  ].join('\n')
}

function renderRewriteOutline(outline: string[]): string {
  return [
    '## 重写提纲',
    ...outline.map((item, index) => `${index + 1}. ${item}`),
    '',
  ].join('\n')
}

function availableModules(question: Question): Array<GapModuleConfig & { text: string }> {
  return MODULES
    .map(module => ({
      ...module,
      text: typeof question[module.key] === 'string' ? stripMarkdown(String(question[module.key])) : '',
    }))
    .filter(module => module.text.trim().length > 0)
}

function analyzeModule(module: GapModuleConfig & { text: string }, answer: string): AnswerGapModule {
  const keywords = extractKeywords(module.text)
  if (keywords.length === 0) {
    return buildModuleResult(module, 65, 'partial')
  }

  const matched = keywords.filter(keyword => answer.includes(keyword))
  // 标准答案常是长段落，不能要求用户逐词覆盖；命中 3-4 个核心词就足以证明该模块已被触及。
  const requiredMatches = Math.min(4, Math.max(2, Math.ceil(keywords.length * 0.35)))
  const ratio = matched.length / requiredMatches
  const score = Math.round(ratio * 100)
  const status = score >= 65 ? 'covered' : score >= 25 ? 'partial' : 'missing'
  const evidence = matched.length > 0
    ? `已覆盖：${matched.slice(0, 4).join('、')}`
    : '回答中暂未命中该模块关键点'

  return {
    key: String(module.key),
    label: module.label,
    score,
    status,
    evidence,
    guidance: module.guidance,
  }
}

function buildModuleResult(
  module: GapModuleConfig,
  score: number,
  status: AnswerGapModule['status'],
): AnswerGapModule {
  return {
    key: String(module.key),
    label: module.label,
    score,
    status,
    evidence: status === 'missing' ? '回答中暂未命中该模块关键点' : '该模块有部分覆盖',
    guidance: module.guidance,
  }
}

function buildRewriteOutline(modules: AnswerGapModule[]): string[] {
  const targets = modules.slice(0, 5)
  if (targets.length === 0) {
    return [
      '保持当前结构，再压缩成 60 秒版本。',
      '补一个真实项目例子，让答案更像面试现场表达。',
    ]
  }
  return targets.map(module => `先补「${module.label}」：${module.guidance}`)
}

function resolveLevel(score: number): AnswerGapReport['level'] {
  if (score >= 75) {
    return 'aligned'
  }
  if (score >= 45) {
    return 'partial'
  }
  return 'high-risk'
}

function resolveTitle(score: number): string {
  if (score >= 75) {
    return '回答接近标准答案'
  }
  if (score >= 45) {
    return '回答有覆盖但仍需补齐'
  }
  return '回答和标准答案差距较大'
}

function buildSummary(score: number, missingModules: AnswerGapModule[]): string {
  if (missingModules.length === 0) {
    return `当前差距校准分 ${score}，关键模块覆盖较完整。`
  }
  return `当前差距校准分 ${score}，优先补齐 ${missingModules.slice(0, 3).map(module => module.label).join('、')}。`
}

function extractKeywords(value: string): string[] {
  const tokens = normalize(value).match(/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/g) ?? []
  return [...new Set(
    tokens
      .flatMap(segment => splitChineseTerms(segment))
      .map(word => word.trim())
      .filter(word => word.length >= 2 && !STOP_WORDS.has(word)),
  )].slice(0, 12)
}

function splitChineseTerms(segment: string): string[] {
  if (/^[\u4e00-\u9fa5]+$/.test(segment) && segment.length > 6) {
    const terms: string[] = []
    for (let index = 0; index <= segment.length - 2; index += 1) {
      terms.push(segment.slice(index, index + 2))
    }
    return [segment, ...terms]
  }
  return [segment]
}

function normalize(value: string): string {
  return stripMarkdown(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~|[\](){}-]/g, ' ')
    .trim()
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
