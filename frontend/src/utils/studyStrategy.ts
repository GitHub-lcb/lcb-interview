import type {
  QuestionStudyState,
  StudyProgress,
  StudyStrategy,
  StudyStrategyAction,
  StudyStrategyFactor,
  StudyStrategyRisk,
} from '../types'

interface ProgressStats {
  totalTracked: number
  mastered: number
  weak: number
  learning: number
  planned: number
  attempts: number
}

export function buildStudyStrategy(progress: StudyProgress): StudyStrategy {
  const stats = collectProgressStats(progress)
  const factors = buildFactors(stats)
  const readinessScore = clampScore(
    factors.reduce((sum, factor) => sum + factor.score, 0),
  )
  const primaryRisk = resolvePrimaryRisk(stats)

  return {
    readinessScore,
    level: resolveLevel(readinessScore),
    title: resolveTitle(readinessScore),
    summary: resolveSummary(stats, primaryRisk),
    primaryRisk,
    factors,
    actions: buildActions(primaryRisk),
  }
}

function collectProgressStats(progress: StudyProgress): ProgressStats {
  const states = Object.values(progress.questionStates)
  return {
    totalTracked: states.length,
    mastered: countByStatus(states, 'mastered'),
    weak: countByStatus(states, 'weak'),
    learning: countByStatus(states, 'learning'),
    planned: progress.dailyPlan.length,
    attempts: Object.values(progress.interviewAttempts).reduce((sum, attempts) => sum + attempts.length, 0),
  }
}

function countByStatus(states: QuestionStudyState[], status: QuestionStudyState['status']): number {
  return states.filter(state => state.status === status).length
}

function buildFactors(stats: ProgressStats): StudyStrategyFactor[] {
  const masteryRatio = stats.totalTracked === 0 ? 0 : stats.mastered / stats.totalTracked
  const weakRatio = stats.totalTracked === 0 ? 0 : stats.weak / stats.totalTracked

  return [
    {
      key: 'mastery',
      label: '掌握沉淀',
      value: `${stats.mastered}/${Math.max(stats.totalTracked, 1)}`,
      // 掌握题代表可稳定输出的知识，权重最高；新用户给基础分，避免空状态显得像失败。
      score: 12 + Math.round(masteryRatio * 36),
      detail: stats.mastered > 0 ? '已掌握题越多，面试可复用素材越稳定。' : '先把高频题加入计划并完成第一轮复盘。',
    },
    {
      key: 'weakness',
      label: '薄弱控制',
      value: `${stats.weak} 道`,
      // 薄弱题过多会直接影响面试表现，所以这里用扣分项压低就绪度。
      score: Math.max(0, 22 - Math.round(weakRatio * 28) - Math.max(0, stats.weak - stats.mastered) * 2),
      detail: stats.weak > stats.mastered ? '薄弱题已经超过掌握题，需要先复盘。' : '薄弱题处于可控范围。',
    },
    {
      key: 'interview',
      label: '表达训练',
      value: `${stats.attempts} 次`,
      // 模拟面试次数反映“会不会说出来”，上限控制在 22 分，避免刷次数掩盖知识短板。
      score: Math.min(22, stats.attempts * 8),
      detail: stats.attempts > 0 ? '已有表达样本，可以继续提高追问质量。' : '还缺少模拟面试样本，建议尽快做一轮。',
    },
    {
      key: 'plan',
      label: '今日推进',
      value: `${stats.planned} 道`,
      // 今日计划体现学习节奏，给中等权重；计划为空时会触发明确行动建议。
      score: Math.min(18, stats.planned * 4),
      detail: stats.planned > 0 ? '今日计划已建立，可以直接进入训练。' : '今日计划为空，先生成一组可执行题目。',
    },
  ]
}

function resolvePrimaryRisk(stats: ProgressStats): StudyStrategyRisk {
  if (stats.totalTracked === 0) {
    return {
      key: 'start-tracking',
      title: '还没有形成备考轨迹',
      description: '先进入题库或路线页，把第一批高频题加入今日计划。',
    }
  }
  if (stats.planned === 0) {
    return {
      key: 'empty-plan',
      title: '今日计划为空',
      description: '没有计划会让刷题变成随机游走，先生成今日计划。',
    }
  }
  if (stats.weak > stats.mastered) {
    return {
      key: 'weak-review',
      title: '薄弱题压过掌握题',
      description: '当前最该处理的是薄弱复盘，而不是继续盲目扩题。',
    }
  }
  if (stats.attempts === 0) {
    return {
      key: 'interview-practice',
      title: '缺少开口表达样本',
      description: '题会看不等于面试会说，先完成一轮模拟面试评分。',
    }
  }
  return {
    key: 'continue-route',
    title: '进入持续强化期',
    description: '继续按岗位路线推进，并用场景题单补项目表达。',
  }
}

function buildActions(risk: StudyStrategyRisk): StudyStrategyAction[] {
  if (risk.key === 'start-tracking') {
    return [
      { key: 'banks', label: '进入题库', description: '先选高频方向建立题目轨迹', to: '/banks', tone: 'primary' },
      { key: 'routes', label: '查看路线', description: '按岗位顺序推进', to: '/routes', tone: 'default' },
      { key: 'practice', label: '试一轮训练', description: '快速体验模拟面试', to: '/practice', tone: 'default' },
    ]
  }
  if (risk.key === 'empty-plan') {
    return [
      { key: 'study', label: '生成今日计划', description: '把题目变成可执行清单', to: '/study', tone: 'primary' },
      { key: 'routes', label: '调整路线', description: '确认当前岗位方向', to: '/routes', tone: 'default' },
      { key: 'banks', label: '继续刷题', description: '补充候选题目', to: '/banks', tone: 'default' },
    ]
  }
  if (risk.key === 'weak-review') {
    return [
      { key: 'study', label: '复盘薄弱题', description: '先处理最影响结果的短板', to: '/study', tone: 'warning' },
      { key: 'practice', label: '薄弱题面试', description: '用表达训练暴露问题', to: '/practice', tone: 'primary' },
      { key: 'experiences', label: '看场景题单', description: '把薄弱点放回面试场景', to: '/experiences', tone: 'default' },
    ]
  }
  if (risk.key === 'interview-practice') {
    return [
      { key: 'practice', label: '开始模拟面试', description: '补齐开口表达样本', to: '/practice', tone: 'primary' },
      { key: 'study', label: '查看今日计划', description: '确认训练题目', to: '/study', tone: 'default' },
      { key: 'experiences', label: '练项目追问', description: '准备真实面试追问', to: '/experiences', tone: 'default' },
    ]
  }
  return [
    { key: 'routes', label: '继续路线推进', description: '保持岗位节奏', to: '/routes', tone: 'primary' },
    { key: 'experiences', label: '强化面试场景', description: '练项目和公司题单', to: '/experiences', tone: 'default' },
    { key: 'practice', label: '再做一轮面试', description: '刷新表达评分', to: '/practice', tone: 'default' },
  ]
}

function resolveLevel(score: number): StudyStrategy['level'] {
  if (score >= 85) {
    return 'sharp'
  }
  if (score >= 65) {
    return 'ready'
  }
  if (score >= 35) {
    return 'building'
  }
  return 'start'
}

function resolveTitle(score: number): string {
  if (score >= 85) {
    return '面试输出强化期'
  }
  if (score >= 65) {
    return '进入可面试准备区'
  }
  if (score >= 35) {
    return '正在建立备考闭环'
  }
  return '先启动备考轨迹'
}

function resolveSummary(stats: ProgressStats, risk: StudyStrategyRisk): string {
  if (stats.totalTracked === 0) {
    return '先跟踪第一批高频题，系统会开始计算短板和行动建议。'
  }
  return `${risk.description} 当前跟踪 ${stats.totalTracked} 道，掌握 ${stats.mastered} 道，薄弱 ${stats.weak} 道。`
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}
