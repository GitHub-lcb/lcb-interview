import type {
  FollowUpDrillCriterionKey,
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'

export type PracticeInterviewerScriptLevel = 'warmup' | 'repair' | 'pressure' | 'advanced' | 'regression'

export interface PracticeInterviewerScriptStep {
  id: string
  criterionKey: FollowUpDrillCriterionKey
  criterionLabel: string
  title: string
  prompt: string
  pressurePoint: string
  answerHint: string
  durationSeconds: number
}

export interface PracticeInterviewerScript {
  level: PracticeInterviewerScriptLevel
  title: string
  summary: string
  totalSeconds: number
  steps: PracticeInterviewerScriptStep[]
  primaryPrompt: string
}

const criterionOrder: InterviewCriterionKey[] = ['coverage', 'structure', 'specificity', 'risk']

const criterionLabels: Record<FollowUpDrillCriterionKey, string> = {
  coverage: '知识覆盖',
  structure: '表达结构',
  specificity: '场景细节',
  risk: '边界风险',
  advanced: '进阶追问',
}

export function buildPracticeInterviewerScript(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
): PracticeInterviewerScript {
  // 本地历史通常已经按新到旧保存；这里仍按时间排序，避免导入旧数据后脚本判断被顺序影响。
  const orderedAttempts = [...attempts].sort((a, b) => timestampOf(b.createdAt) - timestampOf(a.createdAt))
  const latest = orderedAttempts[0]
  const previous = orderedAttempts[1]

  if (!latest) {
    return buildScript(
      'warmup',
      '首次回答预热',
      '先用三步把结论、机制和场景说完整，再提交一次正式评分。',
      buildWarmupSteps(question),
    )
  }

  const weakest = resolveWeakestCriterion(latest.feedback.criteria)
  const mostRegressed = previous
    ? resolveMostRegressedCriterion(latest.feedback.criteria, previous.feedback.criteria)
    : undefined
  const scoreDelta = previous ? latest.feedback.score - previous.feedback.score : 0

  if (previous && scoreDelta <= -5) {
    return buildScript(
      'regression',
      '回落修复追问',
      `最近一次比上次回落 ${Math.abs(scoreDelta)} 分，先追问回落最明显的维度。`,
      buildRegressionSteps(question, mostRegressed ?? criterionToFocus(weakest)),
    )
  }

  if (latest.feedback.score < 60 || weakest.score < 60) {
    return buildScript(
      'repair',
      '低分修复追问',
      `最近评分 ${latest.feedback.score} 分，先把最低维度「${weakest.label}」修到可过线。`,
      buildRepairSteps(question, criterionToFocus(weakest)),
    )
  }

  if (latest.feedback.score >= 80) {
    return buildScript(
      'advanced',
      '进阶面试官脚本',
      '当前答案已经过线，继续用方案权衡、风险边界和压缩表达拉高上限。',
      buildAdvancedSteps(question),
    )
  }

  return buildScript(
    'pressure',
    '过线加压追问',
    `最近评分 ${latest.feedback.score} 分，继续围绕「${weakest.label}」做稳定性验证。`,
    buildPressureSteps(question, criterionToFocus(weakest)),
  )
}

export function buildPracticeInterviewerScriptMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
  now = new Date().toISOString(),
): string {
  const script = buildPracticeInterviewerScript(question, attempts)

  return [
    `# ${question.title} 本题面试官脚本`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    `分类：${question.categoryName || '未分类'}`,
    `难度：${question.difficulty || '未知'}`,
    '',
    renderScriptOverview(script),
    renderScriptSteps(script.steps),
  ].join('\n').trimEnd()
}

function buildScript(
  level: PracticeInterviewerScriptLevel,
  title: string,
  summary: string,
  steps: PracticeInterviewerScriptStep[],
): PracticeInterviewerScript {
  return {
    level,
    title,
    summary,
    totalSeconds: steps.reduce((total, item) => total + item.durationSeconds, 0),
    steps,
    primaryPrompt: steps[0]?.prompt ?? '',
  }
}

function renderScriptOverview(script: PracticeInterviewerScript): string {
  return [
    '## 脚本概览',
    `- 状态：${script.title}`,
    `- 等级：${script.level}`,
    `- 总时长：${formatDuration(script.totalSeconds)}`,
    `- 说明：${script.summary}`,
    '',
  ].join('\n')
}

function renderScriptSteps(steps: PracticeInterviewerScriptStep[]): string {
  if (steps.length === 0) {
    return [
      '## 追问步骤',
      '- 暂无追问步骤，请先完成一次模拟面试评分。',
    ].join('\n')
  }

  return [
    '## 追问步骤',
    ...steps.map((item, index) => [
      `${index + 1}. ${item.title}`,
      `   - 问题：${item.prompt}`,
      `   - 维度：${item.criterionLabel}`,
      `   - 时长：${item.durationSeconds} 秒`,
      `   - 压力点：${item.pressurePoint}`,
      `   - 回答提示：${item.answerHint}`,
    ].join('\n')),
  ].join('\n')
}

function buildWarmupSteps(question: PracticeQueueItem | QuestionSnapshot): PracticeInterviewerScriptStep[] {
  return [
    buildStep({
      criterionKey: 'coverage',
      title: '先给结论',
      prompt: `请用 30 秒回答「${question.title}」：先给结论，再补一句核心原因。`,
      pressurePoint: '面试官先确认你是否能直接回答问题，而不是绕开主题。',
      answerHint: '开头直接说结论，用“因为...”补一条机制原因。',
      durationSeconds: 30,
    }),
    buildStep({
      criterionKey: 'structure',
      title: '补机制链路',
      prompt: `请按“结论 -> 机制 -> 场景 -> 边界”重组「${question.title}」。`,
      pressurePoint: '面试官在看你能否把知识点讲成稳定结构。',
      answerHint: '每段只讲一句，先保证顺序清楚。',
      durationSeconds: 60,
    }),
    buildStep({
      criterionKey: 'specificity',
      title: '落到项目场景',
      prompt: `请给「${question.title}」补一个真实项目或线上故障场景。`,
      pressurePoint: '面试官会继续追问你是否真的在项目里用过。',
      answerHint: '说清触发条件、处理动作和验证指标。',
      durationSeconds: 60,
    }),
  ]
}

function buildRepairSteps(
  question: PracticeQueueItem | QuestionSnapshot,
  focus: CriterionFocus,
): PracticeInterviewerScriptStep[] {
  return [
    buildFocusStep(question, focus, `修复${focus.label}`, 60),
    buildStep({
      criterionKey: 'structure',
      title: '重新组织答案',
      prompt: `请重新回答「${question.title}」，必须按结论、原因、场景、边界四段输出。`,
      pressurePoint: '低分答案通常不是只缺知识，也缺少可复述结构。',
      answerHint: '不要扩写太多，先让四段都出现。',
      durationSeconds: 60,
    }),
    buildStep({
      criterionKey: 'risk',
      title: '补失败边界',
      prompt: `「${question.title}」在哪些场景会失效？你会怎么兜底？`,
      pressurePoint: '面试官会用失败边界判断你是否只会背标准答案。',
      answerHint: '至少说 2 个边界和 1 个兜底动作。',
      durationSeconds: 60,
    }),
  ]
}

function buildPressureSteps(
  question: PracticeQueueItem | QuestionSnapshot,
  focus: CriterionFocus,
): PracticeInterviewerScriptStep[] {
  return [
    buildFocusStep(question, focus, `加压${focus.label}`, 60),
    buildStep({
      criterionKey: 'specificity',
      title: '追项目验证',
      prompt: `放到真实项目里，「${question.title}」你会用什么指标验证回答是对的？`,
      pressurePoint: '过线答案要继续证明可落地，而不是停在概念层。',
      answerHint: '给出触发条件、观测指标和复盘方式。',
      durationSeconds: 60,
    }),
    buildStep({
      criterionKey: 'risk',
      title: '面试官反问',
      prompt: `如果面试官反问这个方案的误区和替代方案，你会怎么答「${question.title}」？`,
      pressurePoint: '面试官会从正向解释转到反向验证。',
      answerHint: '先讲误区，再讲替代方案，最后说明选择理由。',
      durationSeconds: 75,
    }),
  ]
}

function buildAdvancedSteps(question: PracticeQueueItem | QuestionSnapshot): PracticeInterviewerScriptStep[] {
  return [
    buildStep({
      criterionKey: 'advanced',
      title: '方案对比',
      prompt: `围绕「${question.title}」，请用“方案 A / 方案 B / 取舍理由 / 我的选择”做对比回答。`,
      pressurePoint: '高分题要证明你能做技术取舍，而不是只复述单一方案。',
      answerHint: '方案 A 和方案 B 都要讲优缺点，最后给选择依据。',
      durationSeconds: 75,
    }),
    buildStep({
      criterionKey: 'risk',
      title: '压风险边界',
      prompt: `如果「${question.title}」放到高并发或线上故障场景，最大的风险和兜底是什么？`,
      pressurePoint: '面试官会把稳定答案继续推到极端场景。',
      answerHint: '说清风险触发条件、影响范围和兜底开关。',
      durationSeconds: 60,
    }),
    buildStep({
      criterionKey: 'structure',
      title: '45 秒压缩',
      prompt: `请把「${question.title}」压缩成 45 秒版本，只保留结论、证据和风险。`,
      pressurePoint: '高压面试里，表达速度和信息密度同样重要。',
      answerHint: '删掉铺垫，保留 1 个机制证据和 1 个风险边界。',
      durationSeconds: 45,
    }),
  ]
}

function buildRegressionSteps(
  question: PracticeQueueItem | QuestionSnapshot,
  focus: CriterionFocus,
): PracticeInterviewerScriptStep[] {
  return [
    buildFocusStep(question, focus, `追回${focus.label}`, 60),
    buildStep({
      criterionKey: 'structure',
      title: '复盘丢分原因',
      prompt: `请复盘「${question.title}」最近一次为什么比上次弱，并用一句话修正表达顺序。`,
      pressurePoint: '回落时先找丢分原因，否则下一次重答会继续摇摆。',
      answerHint: '只比较表达差异，不泛泛归因。',
      durationSeconds: 45,
    }),
    buildStep({
      criterionKey: 'specificity',
      title: '重新给场景',
      prompt: `请重新给「${question.title}」补一个可验证的项目场景和指标。`,
      pressurePoint: '回落题需要用具体证据重新稳定住答案。',
      answerHint: '指标要能被观察，例如耗时、错误率、吞吐或容量。',
      durationSeconds: 60,
    }),
  ]
}

function buildFocusStep(
  question: PracticeQueueItem | QuestionSnapshot,
  focus: CriterionFocus,
  title: string,
  durationSeconds: number,
): PracticeInterviewerScriptStep {
  return buildStep({
    criterionKey: focus.key,
    title,
    prompt: `请围绕「${question.title}」补齐${focus.label}，回答时必须给出可被面试官继续追问的证据。`,
    pressurePoint: pressurePointFor(focus.key),
    answerHint: answerHintFor(focus.key),
    durationSeconds,
  })
}

function buildStep(input: {
  criterionKey: FollowUpDrillCriterionKey
  title: string
  prompt: string
  pressurePoint: string
  answerHint: string
  durationSeconds: number
}): PracticeInterviewerScriptStep {
  return {
    id: `${input.criterionKey}-${hashText(input.prompt)}`,
    criterionKey: input.criterionKey,
    criterionLabel: criterionLabels[input.criterionKey],
    title: input.title,
    prompt: input.prompt,
    pressurePoint: input.pressurePoint,
    answerHint: input.answerHint,
    durationSeconds: input.durationSeconds,
  }
}

interface CriterionFocus {
  key: FollowUpDrillCriterionKey
  label: string
  score: number
  delta?: number
}

function criterionToFocus(criterion: InterviewCriterion): CriterionFocus {
  return {
    key: criterion.key,
    label: criterion.label || criterionLabels[criterion.key],
    score: criterion.score,
  }
}

function resolveWeakestCriterion(criteria: InterviewCriterion[]): InterviewCriterion {
  return [...criteria].sort((a, b) => a.score - b.score)[0] ?? {
    key: 'specificity',
    label: criterionLabels.specificity,
    score: 0,
    summary: '暂无评分维度',
  }
}

function resolveMostRegressedCriterion(
  latestCriteria: InterviewCriterion[],
  previousCriteria: InterviewCriterion[],
): CriterionFocus {
  const latestByKey = new Map(latestCriteria.map(item => [item.key, item]))
  const previousByKey = new Map(previousCriteria.map(item => [item.key, item]))

  return criterionOrder
    .map(key => {
      const latest = latestByKey.get(key)
      const previous = previousByKey.get(key)
      const latestScore = latest?.score ?? 0
      const previousScore = previous?.score ?? 0

      return {
        key,
        label: latest?.label ?? previous?.label ?? criterionLabels[key],
        score: latestScore,
        delta: latestScore - previousScore,
      }
    })
    .sort((a, b) => a.delta - b.delta || a.score - b.score)[0] ?? {
    key: 'specificity',
    label: criterionLabels.specificity,
    score: 0,
    delta: 0,
  }
}

function pressurePointFor(key: FollowUpDrillCriterionKey): string {
  if (key === 'coverage') {
    return '面试官在确认你是否理解机制和替代方案。'
  }
  if (key === 'structure') {
    return '面试官在压缩时间，要求表达更清晰。'
  }
  if (key === 'specificity') {
    return '面试官在追真实项目、数据指标和验证路径。'
  }
  if (key === 'risk') {
    return '面试官在确认你是否知道方案边界和失败代价。'
  }
  return '面试官在把问题从会不会推进到能否权衡取舍。'
}

function answerHintFor(key: FollowUpDrillCriterionKey): string {
  if (key === 'coverage') {
    return '补定义、机制、替代方案，不要只背结论。'
  }
  if (key === 'structure') {
    return '用结论、原因、场景、边界四句回答。'
  }
  if (key === 'specificity') {
    return '必须出现项目背景、动作和验证指标。'
  }
  if (key === 'risk') {
    return '至少说 2 个失败边界和 1 个兜底方案。'
  }
  return '用方案对比、取舍理由和最终选择组织答案。'
}

function timestampOf(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(totalSeconds / 60))
  return `${minutes} 分钟`
}

function hashText(value: string): string {
  let hash = 0
  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash).toString(36)
}
