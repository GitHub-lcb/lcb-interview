import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  FieldTimeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import type { PracticeQueueItem, StudyProgress } from '../types'
import {
  buildPracticeSessionDailyCompletion,
  buildPracticeSessionNextTrainingQueue,
} from '../utils/practiceSessionReport'
import { formatNextTrainingQueueItemMeta } from '../utils/nextTrainingQueue'

interface PracticePostScoreNextStepPanelProps {
  queue: PracticeQueueItem[]
  progress: StudyProgress
  now?: string
  firstRunProgress?: {
    answeredCount: number
    totalCount: number
    nextQuestionTitle?: string
    onContinue: () => void
    variant?: 'launchpad' | 'repair' | 'rehearsal'
  }
  onNavigate: (to: string) => void
}

function appendPracticeHandoffSource(to: string, source: string) {
  if (!to.startsWith('/practice')) {
    return to
  }

  const [pathAndSearch, hash] = to.split('#')
  const normalizedPath = /[?&]from=/.test(pathAndSearch)
    ? pathAndSearch.replace(/([?&])from=[^&]*/, `$1from=${source}`)
    : `${pathAndSearch}${pathAndSearch.includes('?') ? '&' : '?'}from=${source}`

  return hash ? `${normalizedPath}#${hash}` : normalizedPath
}

export default function PracticePostScoreNextStepPanel({
  queue,
  progress,
  now,
  firstRunProgress,
  onNavigate,
}: PracticePostScoreNextStepPanelProps) {
  const checkpointTime = now ?? progress.updatedAt
  const nextTrainingQueue = useMemo(
    () => buildPracticeSessionNextTrainingQueue(queue, progress, checkpointTime, 2),
    [checkpointTime, progress, queue],
  )
  const dailyClosure = useMemo(
    () => buildPracticeSessionDailyCompletion(queue, progress, checkpointTime),
    [checkpointTime, progress, queue],
  )
  const riskCount = dailyClosure.reviewDebtCount + dailyClosure.weakCount
  const isFirstRunComplete =
    firstRunProgress !== undefined
    && firstRunProgress.totalCount > 0
    && firstRunProgress.answeredCount >= firstRunProgress.totalCount
  const activeFirstRunProgress =
    firstRunProgress && !isFirstRunComplete
      ? firstRunProgress
      : undefined
  const shouldShowFirstRunProgress = firstRunProgress !== undefined && firstRunProgress.totalCount > 0
  const isFirstRunRepairProgress = firstRunProgress?.variant === 'repair'
  const isFirstRunRehearsalProgress = firstRunProgress?.variant === 'rehearsal'
  const isFirstRunRepairCleared = isFirstRunComplete && isFirstRunRepairProgress && riskCount === 0
  const isFirstRunRehearsalCleared = isFirstRunComplete && isFirstRunRehearsalProgress && riskCount === 0
  const shouldHideNextTraining = isFirstRunRepairCleared || isFirstRunRehearsalCleared
  const visibleNextTrainingCount = shouldHideNextTraining ? 0 : nextTrainingQueue.totalCount
  const visibleNextTrainingItems = shouldHideNextTraining ? [] : nextTrainingQueue.items
  const firstRunMetricLabel = isFirstRunRepairProgress
    ? '补弱进度'
    : isFirstRunRehearsalProgress ? '复述进度' : '首练进度'
  const listItemHandoffSource = shouldShowFirstRunProgress
    ? isFirstRunRepairProgress || isFirstRunComplete
      ? 'first-run-repair'
      : isFirstRunRehearsalProgress ? 'first-run-rehearsal' : 'first-run'
    : undefined
  const title = activeFirstRunProgress
    ? isFirstRunRepairProgress
      ? '继续修复首练补弱队列'
      : isFirstRunRehearsalProgress ? '继续复述首练过线题' : '继续完成首练队列'
    : isFirstRunRepairCleared
      ? '首练补弱已过线'
    : isFirstRunRehearsalCleared
      ? '首练过线复述已完成'
    : isFirstRunComplete
      ? isFirstRunRepairProgress
        ? '首练补弱队列已完成'
        : isFirstRunRehearsalProgress ? '首练过线复述已完成' : '首练队列已完成'
      : visibleNextTrainingCount > 0 ? '趁热处理下一轮训练' : dailyClosure.title
  const summary = activeFirstRunProgress
    ? activeFirstRunProgress.nextQuestionTitle
      ? isFirstRunRepairProgress
        ? `已修复 ${activeFirstRunProgress.answeredCount} / ${activeFirstRunProgress.totalCount}，下一题继续补弱「${activeFirstRunProgress.nextQuestionTitle}」。`
        : isFirstRunRehearsalProgress
          ? `已复述 ${activeFirstRunProgress.answeredCount} / ${activeFirstRunProgress.totalCount}，下一题继续脱稿「${activeFirstRunProgress.nextQuestionTitle}」。`
          : `已完成 ${activeFirstRunProgress.answeredCount} / ${activeFirstRunProgress.totalCount}，下一题继续回答「${activeFirstRunProgress.nextQuestionTitle}」。`
      : isFirstRunRepairProgress
        ? `已修复 ${activeFirstRunProgress.answeredCount} / ${activeFirstRunProgress.totalCount}，继续修复本轮首练风险题。`
        : isFirstRunRehearsalProgress
          ? `已复述 ${activeFirstRunProgress.answeredCount} / ${activeFirstRunProgress.totalCount}，继续完成本轮过线题脱稿验证。`
          : `已完成 ${activeFirstRunProgress.answeredCount} / ${activeFirstRunProgress.totalCount}，继续完成本轮首练。`
    : isFirstRunRepairCleared
      ? `已修复 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，本轮首练补弱已过线，回到战报沉淀可复述证据。`
    : isFirstRunRehearsalCleared
      ? `已复述 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，本轮过线题已完成脱稿验证，回到战报沉淀可复述证据。`
    : isFirstRunComplete
      ? isFirstRunRepairProgress
        ? visibleNextTrainingCount > 0
          ? `已修复 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，继续按战报处理剩余风险题。`
          : `已修复 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，本轮首练补弱已完成，继续收尾今日闭环。`
        : isFirstRunRehearsalProgress
          ? visibleNextTrainingCount > 0
            ? `已复述 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，本轮过线题已完成脱稿验证，继续处理新暴露的风险题。`
            : `已复述 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，本轮过线题已完成脱稿验证，继续收尾今日闭环。`
        : visibleNextTrainingCount > 0
          ? `已完成 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，先看本轮战报，再按风险题补弱。`
          : `已完成 ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}，本轮首练已形成战报，继续收尾今日闭环。`
    : visibleNextTrainingCount > 0 ? nextTrainingQueue.summary : dailyClosure.summary
  const primaryActionTo = isFirstRunRepairCleared
    ? dailyClosure.primaryAction.to
    : isFirstRunRehearsalCleared
    ? dailyClosure.primaryAction.to
    : isFirstRunComplete && visibleNextTrainingCount === 0
    ? dailyClosure.primaryAction.to
    : isFirstRunComplete
      ? appendPracticeHandoffSource(nextTrainingQueue.primaryAction.to, 'first-run-repair')
      : nextTrainingQueue.primaryAction.to
  const primaryActionLabel = activeFirstRunProgress
    ? `继续第 ${activeFirstRunProgress.answeredCount + 1} 题`
    : isFirstRunRepairCleared
      ? '查看首练战报'
    : isFirstRunRehearsalCleared
      ? '查看首练战报'
    : isFirstRunComplete && visibleNextTrainingCount > 0
      ? isFirstRunRepairProgress
        ? '继续补弱'
        : isFirstRunRehearsalProgress ? '处理风险' : '按战报补弱'
    : isFirstRunComplete ? dailyClosure.primaryAction.label : nextTrainingQueue.primaryAction.label
  const secondaryAction = isFirstRunRepairCleared || isFirstRunRehearsalCleared
    ? { label: '回到启动台', to: '/' }
    : dailyClosure.primaryAction

  return (
    <section className="practice-post-score-next-step" aria-label="评分后下一步">
      <div className="practice-post-score-next-step-head">
        <div>
          <div className="dashboard-kicker">
            <ThunderboltOutlined />
            评分后下一步
          </div>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
        <div className="practice-post-score-next-step-actions">
          <Button
            type="primary"
            icon={<FieldTimeOutlined />}
            onClick={() => {
              if (activeFirstRunProgress) {
                activeFirstRunProgress.onContinue()
                return
              }
              onNavigate(primaryActionTo)
            }}
          >
            {primaryActionLabel}
            <ArrowRightOutlined />
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={() => onNavigate(secondaryAction.to)}>
            {secondaryAction.label}
          </Button>
        </div>
      </div>

      <div className="practice-post-score-next-step-metrics">
          <article
            aria-label={
              shouldShowFirstRunProgress
                ? `${firstRunMetricLabel} ${firstRunProgress.answeredCount} / ${firstRunProgress.totalCount}`
                : `完成率 ${dailyClosure.completionRate}%`
            }
          >
            {shouldShowFirstRunProgress ? (
              <>
                <span>{firstRunMetricLabel}</span>
                <strong>{firstRunProgress.answeredCount} / {firstRunProgress.totalCount}</strong>
                <small>{isFirstRunRepairProgress ? '首练风险题' : isFirstRunRehearsalProgress ? '首练过线题' : '本轮高频题'}</small>
              </>
            ) : (
              <>
                <span>完成率</span>
                <strong>{dailyClosure.completionRate}%</strong>
                <small>今日闭环</small>
              </>
            )}
          </article>
          <article aria-label={`风险 ${riskCount}`}>
            <span>风险</span>
            <strong>{riskCount}</strong>
            <small>复习债 + 薄弱题</small>
          </article>
          <article aria-label={`下一轮 ${visibleNextTrainingCount}`}>
            <span>下一轮</span>
            <strong>{visibleNextTrainingCount}</strong>
            <small>已按优先级去重</small>
        </article>
      </div>

      {visibleNextTrainingItems.length > 0 && (
        <div className="practice-post-score-next-step-list">
          {visibleNextTrainingItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(
                listItemHandoffSource
                  ? appendPracticeHandoffSource(item.to, listItemHandoffSource)
                  : item.to,
              )}
            >
              <strong>{item.title}</strong>
              <span>{formatNextTrainingQueueItemMeta(item)}</span>
              <small>{item.reason}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
