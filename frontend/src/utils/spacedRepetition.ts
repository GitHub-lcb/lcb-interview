import type { QuestionStudyState, RecallGrade, StudyQuestionStatus } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

/** SM-2 初始难度系数：默认 2.5，答错降、答对升，越低代表这道题对该用户越难记。 */
export const SM2_EASE_DEFAULT = 2.5
export const SM2_EASE_MIN = 1.3
export const SM2_EASE_MAX = 2.8

/** 各评分档位对难度系数的调整量（沿用 SM-2 经验值，easy 额外 +0.15）。 */
const EASE_ADJUSTMENT: Record<RecallGrade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
}

/** 首次复习间隔：good 档第 1 次 1 天、第 2 次 6 天，之后按间隔 × 难度系数指数拉长。 */
const FIRST_INTERVAL_DAYS = 1
const SECOND_INTERVAL_DAYS = 6

export interface RecallGradeOption {
  grade: RecallGrade
  label: string
  hint: string
  /** AntD Button type，用于区分视觉权重。 */
  tone: 'default' | 'primary' | 'dashed'
}

/** 翻转卡背面的评分按钮配置，顺序即键盘快捷键 1-4 的顺序。 */
export const RECALL_GRADE_OPTIONS: RecallGradeOption[] = [
  { grade: 'again', label: '忘了', hint: '明天再见，间隔重置', tone: 'dashed' },
  { grade: 'hard', label: '模糊', hint: '缩短间隔再来一次', tone: 'default' },
  { grade: 'good', label: '记住了', hint: '按正常节奏拉长间隔', tone: 'primary' },
  { grade: 'easy', label: '很简单', hint: '大幅拉长间隔', tone: 'default' },
]

export interface RecallScheduleResult {
  status: StudyQuestionStatus
  easeFactor: number
  intervalDays: number
  dueAt: string
}

/**
 * 根据当前学习状态和回忆评分，计算下一次复习的 SM-2 排期。
 *
 * 为什么用 SM-2 而不是固定间隔表：固定间隔表对「答得好」和「答得差」一视同仁，
 * 背题场景下会造成已熟练的题反复打扰、快忘的题又出现太晚。SM-2 让间隔跟随
 * 每道题的实际回忆表现自适应伸缩，答差立即缩短、答好指数拉长。
 *
 * @param state 当前题目学习状态（可能没有 SM-2 字段，视为首次背诵）
 * @param grade 本次回忆评分档位
 * @param now   评分时间，默认当前时间
 * @returns 下一次的掌握状态、难度系数、间隔天数和到期时间
 */
export function scheduleNextRecall(
  state: Pick<QuestionStudyState, 'easeFactor' | 'intervalDays' | 'reviewCount'>,
  grade: RecallGrade,
  now: Date = new Date(),
): RecallScheduleResult {
  const easeFactor = clampEase((state.easeFactor ?? SM2_EASE_DEFAULT) + EASE_ADJUSTMENT[grade])
  const prevInterval = state.intervalDays ?? 0

  // 间隔计算：again 重置为 1 天；hard 用 1.2 倍温和放大；good 走标准 SM-2 序列；easy 乘上 1.3 的奖励系数。
  let intervalDays: number
  if (grade === 'again') {
    intervalDays = FIRST_INTERVAL_DAYS
  } else if (grade === 'hard') {
    intervalDays = Math.max(FIRST_INTERVAL_DAYS, Math.round(prevInterval * 1.2))
  } else if (grade === 'good') {
    if (prevInterval < FIRST_INTERVAL_DAYS) {
      intervalDays = FIRST_INTERVAL_DAYS
    } else if (prevInterval === FIRST_INTERVAL_DAYS) {
      intervalDays = SECOND_INTERVAL_DAYS
    } else {
      intervalDays = Math.round(prevInterval * easeFactor)
    }
  } else {
    const baseInterval = prevInterval < FIRST_INTERVAL_DAYS
      ? SECOND_INTERVAL_DAYS
      : Math.max(prevInterval, SECOND_INTERVAL_DAYS)
    intervalDays = Math.round(baseInterval * easeFactor * 1.3)
  }

  // 间隔上限 90 天：超过这个长度对面试冲刺没有意义，且避免极端难度系数下无限拉长。
  intervalDays = Math.min(90, intervalDays)

  return {
    status: statusFromGrade(grade, intervalDays),
    easeFactor,
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  }
}

/**
 * 预览某评分档位会得到的间隔天数，用于按钮上的「下次 N 天后」提示，
 * 让用户在评分前就能感知不同档位对排期的影响。
 */
export function previewIntervalDays(
  state: Pick<QuestionStudyState, 'easeFactor' | 'intervalDays' | 'reviewCount'>,
  grade: RecallGrade,
): number {
  return scheduleNextRecall(state, grade, new Date(0)).intervalDays
}

/** 把 SM-2 难度系数夹在 [1.3, 2.8]，防止极端值导致间隔坍缩或爆炸。 */
function clampEase(value: number): number {
  return Math.min(SM2_EASE_MAX, Math.max(SM2_EASE_MIN, Math.round(value * 100) / 100))
}

/**
 * 评分档位映射到学习状态：忘了直接标记薄弱进高频队列；模糊与记住保持学习中；
 * 很简单且间隔已经拉到 7 天以上视为已掌握，退出高频复习。
 */
function statusFromGrade(grade: RecallGrade, intervalDays: number): StudyQuestionStatus {
  if (grade === 'again') {
    return 'weak'
  }
  if (grade === 'easy' && intervalDays >= 7) {
    return 'mastered'
  }
  return 'learning'
}

/** 判断题目当前是否已到期需要复习（无 dueAt 的旧数据视为未启用 SM-2）。 */
export function isRecallDue(state: Pick<QuestionStudyState, 'dueAt'>, now: Date = new Date()): boolean {
  if (!state.dueAt) {
    return false
  }
  return new Date(state.dueAt).getTime() <= now.getTime()
}
