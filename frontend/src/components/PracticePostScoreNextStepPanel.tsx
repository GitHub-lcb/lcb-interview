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
import { appendPracticeHandoffSource } from '../utils/practiceRoute'

type ScopedQueueProgressVariant =
  | 'launchpad'
  | 'repair'
  | 'rehearsal'
  | 'review-due'
  | 'active-recall'
  | 'daily-plan'
  | 'resume-draft'
  | 'ability-gap'
  | 'experience-playbook'
  | 'next-training'
  | 'interview-retrospective'
  | 'interview-brief'
  | 'pace-coach'
  | 'filtered-list'

interface ScopedQueueProgress {
  answeredCount: number
  totalCount: number
  nextQuestionTitle?: string
  onContinue: () => void
  variant?: ScopedQueueProgressVariant
}

interface PracticePostScoreNextStepPanelProps {
  queue: PracticeQueueItem[]
  progress: StudyProgress
  now?: string
  scopedQueueProgress?: ScopedQueueProgress
  onNavigate: (to: string) => void
}

export default function PracticePostScoreNextStepPanel({
  queue,
  progress,
  now,
  scopedQueueProgress,
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
  const isScopedQueueComplete =
    scopedQueueProgress !== undefined
    && scopedQueueProgress.totalCount > 0
    && scopedQueueProgress.answeredCount >= scopedQueueProgress.totalCount
  const activeScopedQueueProgress =
    scopedQueueProgress && !isScopedQueueComplete
      ? scopedQueueProgress
      : undefined
  const shouldShowScopedQueueProgress = scopedQueueProgress !== undefined && scopedQueueProgress.totalCount > 0
  const isFirstRunRepairProgress = scopedQueueProgress?.variant === 'repair'
  const isFirstRunRehearsalProgress = scopedQueueProgress?.variant === 'rehearsal'
  const isReviewDueProgress = scopedQueueProgress?.variant === 'review-due'
  const isActiveRecallProgress = scopedQueueProgress?.variant === 'active-recall'
  const isDailyPlanProgress = scopedQueueProgress?.variant === 'daily-plan'
  const isResumeDraftProgress = scopedQueueProgress?.variant === 'resume-draft'
  const isAbilityGapProgress = scopedQueueProgress?.variant === 'ability-gap'
  const isExperiencePlaybookProgress = scopedQueueProgress?.variant === 'experience-playbook'
  const isNextTrainingProgress = scopedQueueProgress?.variant === 'next-training'
  const isInterviewRetrospectiveProgress = scopedQueueProgress?.variant === 'interview-retrospective'
  const isInterviewBriefProgress = scopedQueueProgress?.variant === 'interview-brief'
  const isPaceCoachProgress = scopedQueueProgress?.variant === 'pace-coach'
  const isFilteredListProgress = scopedQueueProgress?.variant === 'filtered-list'
  const isFirstRunRepairCleared = isScopedQueueComplete && isFirstRunRepairProgress && riskCount === 0
  const isFirstRunRehearsalCleared = isScopedQueueComplete && isFirstRunRehearsalProgress && riskCount === 0
  const shouldHideNextTraining = isFirstRunRepairCleared || isFirstRunRehearsalCleared
  const visibleNextTrainingCount = shouldHideNextTraining ? 0 : nextTrainingQueue.totalCount
  const visibleNextTrainingItems = shouldHideNextTraining ? [] : nextTrainingQueue.items
  const scopedQueueMetricLabel = isActiveRecallProgress
    ? '回忆进度'
    : isReviewDueProgress
    ? '复习进度'
    : isDailyPlanProgress
      ? '计划进度'
    : isResumeDraftProgress
      ? '恢复进度'
    : isAbilityGapProgress
      ? '能力进度'
    : isExperiencePlaybookProgress
      ? '押题进度'
    : isNextTrainingProgress
      ? '训练进度'
    : isInterviewRetrospectiveProgress
      ? '复盘进度'
    : isInterviewBriefProgress
      ? '热身进度'
    : isPaceCoachProgress
      ? '配速进度'
    : isFilteredListProgress
      ? '筛选进度'
    : isFirstRunRepairProgress
    ? '补弱进度'
    : isFirstRunRehearsalProgress ? '复述进度' : '首练进度'
  const listItemHandoffSource = shouldShowScopedQueueProgress
    ? isActiveRecallProgress
      ? 'review-due'
      : isReviewDueProgress
      ? 'review-due'
      : isDailyPlanProgress
        ? 'daily-plan'
      : isResumeDraftProgress
        ? 'resume-draft'
      : isAbilityGapProgress
        ? 'ability-gap'
      : isExperiencePlaybookProgress
        ? 'experience-playbook'
      : isNextTrainingProgress
        ? 'next-training'
      : isInterviewRetrospectiveProgress
        ? 'interview-retrospective'
      : isInterviewBriefProgress
        ? 'interview-brief'
      : isPaceCoachProgress
        ? 'pace-coach'
      : isFilteredListProgress
        ? 'filtered-list'
      : isFirstRunRepairProgress || isScopedQueueComplete
      ? 'first-run-repair'
      : isFirstRunRehearsalProgress ? 'first-run-rehearsal' : 'first-run'
    : undefined
  const title = activeScopedQueueProgress
    ? isFirstRunRepairProgress
      ? '继续修复首练补弱队列'
      : isFirstRunRehearsalProgress
        ? '继续复述首练过线题'
        : isActiveRecallProgress
          ? '继续主动回忆队列'
        : isReviewDueProgress
          ? '继续清理到期复习队列'
          : isDailyPlanProgress
            ? '继续今日计划队列'
          : isResumeDraftProgress
            ? '继续恢复未提交回答'
          : isAbilityGapProgress
            ? '继续补齐能力短板'
            : isExperiencePlaybookProgress
              ? '继续真实面试押题队列'
              : isNextTrainingProgress
                ? '继续下一轮训练队列'
                : isInterviewRetrospectiveProgress
                  ? '继续面试复盘队列'
                  : isInterviewBriefProgress
                    ? '继续面试简报热身队列'
                    : isPaceCoachProgress
                      ? '继续配速训练队列'
                    : isFilteredListProgress ? '继续当前筛选题单' : '继续完成首练队列'
    : isFirstRunRepairCleared
      ? '首练补弱已过线'
    : isFirstRunRehearsalCleared
      ? '首练过线复述已完成'
    : isScopedQueueComplete
      ? isFirstRunRepairProgress
        ? '首练补弱队列已完成'
        : isFirstRunRehearsalProgress
          ? '首练过线复述已完成'
          : isActiveRecallProgress
            ? '主动回忆队列已完成'
          : isReviewDueProgress
            ? '到期复习队列已完成'
            : isDailyPlanProgress
              ? '今日计划队列已完成'
            : isResumeDraftProgress
              ? '未提交回答已恢复'
            : isAbilityGapProgress
              ? '能力短板队列已完成'
              : isExperiencePlaybookProgress
                ? '真实面试押题已完成'
                : isNextTrainingProgress
                  ? '下一轮训练队列已完成'
                  : isInterviewRetrospectiveProgress
                    ? '面试复盘队列已完成'
                    : isInterviewBriefProgress
                      ? '面试简报热身队列已完成'
                      : isPaceCoachProgress
                        ? '配速训练队列已完成'
                      : isFilteredListProgress ? '当前筛选题单已完成' : '首练队列已完成'
      : visibleNextTrainingCount > 0 ? '趁热处理下一轮训练' : dailyClosure.title
  const summary = activeScopedQueueProgress
    ? activeScopedQueueProgress.nextQuestionTitle
      ? isFirstRunRepairProgress
        ? `已修复 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续补弱「${activeScopedQueueProgress.nextQuestionTitle}」。`
        : isFirstRunRehearsalProgress
          ? `已复述 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续脱稿「${activeScopedQueueProgress.nextQuestionTitle}」。`
          : isActiveRecallProgress
            ? `已回忆 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续脱稿回忆「${activeScopedQueueProgress.nextQuestionTitle}」。`
          : isReviewDueProgress
            ? `已复习 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续补回「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isDailyPlanProgress
              ? `已完成 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续回答「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isResumeDraftProgress
              ? `已恢复 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续评分「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isAbilityGapProgress
              ? `已训练 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续突破「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isExperiencePlaybookProgress
              ? `已压测 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续拆解「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isNextTrainingProgress
              ? `已训练 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续回答「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isInterviewRetrospectiveProgress
              ? `已复盘 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续重答「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isInterviewBriefProgress
              ? `已热身 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续开口热身「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isPaceCoachProgress
              ? `已收口 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续完成今日配速「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : isFilteredListProgress
              ? `已训练 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续回答「${activeScopedQueueProgress.nextQuestionTitle}」。`
            : `已完成 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，下一题继续回答「${activeScopedQueueProgress.nextQuestionTitle}」。`
      : isFirstRunRepairProgress
        ? `已修复 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续修复本轮首练风险题。`
        : isFirstRunRehearsalProgress
          ? `已复述 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮过线题脱稿验证。`
          : isActiveRecallProgress
            ? `已回忆 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮多次遇见题主动回忆。`
          : isReviewDueProgress
            ? `已复习 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续清理本轮到期题。`
            : isDailyPlanProgress
              ? `已完成 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮今日计划。`
            : isResumeDraftProgress
              ? `已恢复 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续补完本轮未提交回答。`
            : isAbilityGapProgress
              ? `已训练 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续补齐本轮能力短板。`
            : isExperiencePlaybookProgress
              ? `已压测 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮真实面试押题。`
            : isNextTrainingProgress
              ? `已训练 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮下一轮训练。`
            : isInterviewRetrospectiveProgress
              ? `已复盘 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续重答本轮低分面试题。`
            : isInterviewBriefProgress
              ? `已热身 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮面试前热身题。`
            : isPaceCoachProgress
              ? `已收口 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮今日配速题。`
            : isFilteredListProgress
              ? `已训练 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮筛选题。`
            : `已完成 ${activeScopedQueueProgress.answeredCount} / ${activeScopedQueueProgress.totalCount}，继续完成本轮首练。`
    : isFirstRunRepairCleared
      ? `已修复 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮首练补弱已过线，回到战报沉淀可复述证据。`
    : isFirstRunRehearsalCleared
      ? `已复述 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮过线题已完成脱稿验证，回到战报沉淀可复述证据。`
    : isScopedQueueComplete
      ? isFirstRunRepairProgress
        ? visibleNextTrainingCount > 0
          ? `已修复 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，继续按战报处理剩余风险题。`
          : `已修复 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮首练补弱已完成，继续收尾今日闭环。`
        : isFirstRunRehearsalProgress
          ? visibleNextTrainingCount > 0
            ? `已复述 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮过线题已完成脱稿验证，继续处理新暴露的风险题。`
            : `已复述 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮过线题已完成脱稿验证，继续收尾今日闭环。`
          : isActiveRecallProgress
            ? `已回忆 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮多次遇见题已完成主动回忆，回到复习计划安排下一次间隔。`
          : isReviewDueProgress
            ? `已复习 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮到期题已处理，回到复习计划安排下一次间隔。`
            : isDailyPlanProgress
              ? `已完成 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮今日计划已完成，回到学习计划收口今日闭环。`
            : isResumeDraftProgress
              ? `已恢复 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮未提交回答已完成评分，回到学习计划继续收口。`
            : isAbilityGapProgress
              ? `已训练 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮能力短板已完成，回到路线图安排下一段训练。`
              : isExperiencePlaybookProgress
                ? `已压测 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮真实面试押题已完成，回到面经场景沉淀追问材料。`
                : isNextTrainingProgress
                  ? `已训练 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮下一轮训练已完成，回到战报继续收口。`
                  : isInterviewRetrospectiveProgress
                    ? `已复盘 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮面试复盘已完成，回到学习中心安排下一步。`
                  : isInterviewBriefProgress
                    ? `已热身 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮面试简报热身已完成，回到学习中心收口风险。`
                    : isPaceCoachProgress
                      ? `已收口 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮配速训练已完成，回到学习中心安排明日节奏。`
                    : isFilteredListProgress
                      ? `已训练 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮当前筛选题单已完成，回到题库继续筛选下一轮。`
        : visibleNextTrainingCount > 0
          ? `已完成 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，先看本轮战报，再按风险题补弱。`
          : `已完成 ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}，本轮首练已形成战报，继续收尾今日闭环。`
    : visibleNextTrainingCount > 0 ? nextTrainingQueue.summary : dailyClosure.summary
  const primaryActionTo = isFirstRunRepairCleared
    ? dailyClosure.primaryAction.to
    : isFirstRunRehearsalCleared
    ? dailyClosure.primaryAction.to
    : isScopedQueueComplete && visibleNextTrainingCount === 0
    ? dailyClosure.primaryAction.to
    : isScopedQueueComplete
      ? appendPracticeHandoffSource(
        nextTrainingQueue.primaryAction.to,
        isActiveRecallProgress || isReviewDueProgress
          ? 'review-due'
          : isAbilityGapProgress
            ? 'ability-gap'
            : isDailyPlanProgress
              ? 'daily-plan'
            : isResumeDraftProgress
              ? 'resume-draft'
            : isExperiencePlaybookProgress
              ? 'experience-playbook'
              : isNextTrainingProgress
                ? 'next-training'
                : isInterviewRetrospectiveProgress
                  ? 'interview-retrospective'
                : isInterviewBriefProgress
                  ? 'interview-brief'
                  : isPaceCoachProgress
                    ? 'pace-coach'
                  : isFilteredListProgress ? 'filtered-list' : 'first-run-repair',
      )
      : nextTrainingQueue.primaryAction.to
  const primaryActionLabel = activeScopedQueueProgress
    ? `继续第 ${activeScopedQueueProgress.answeredCount + 1} 题`
    : isFirstRunRepairCleared
      ? '查看首练战报'
    : isFirstRunRehearsalCleared
      ? '查看首练战报'
    : isScopedQueueComplete && visibleNextTrainingCount > 0
      ? isActiveRecallProgress
        ? '继续复习计划'
        : isReviewDueProgress
        ? '继续清复习债'
        : isDailyPlanProgress
          ? '继续今日计划'
        : isResumeDraftProgress
          ? '继续训练'
        : isAbilityGapProgress
          ? '继续补短板'
        : isExperiencePlaybookProgress
          ? '继续押题'
        : isNextTrainingProgress
          ? '继续训练'
        : isInterviewRetrospectiveProgress
          ? '继续复盘'
        : isInterviewBriefProgress
          ? '继续热身'
        : isPaceCoachProgress
          ? '继续配速'
        : isFilteredListProgress
          ? '继续训练'
        : isFirstRunRepairProgress
        ? '继续补弱'
        : isFirstRunRehearsalProgress ? '处理风险' : '按战报补弱'
    : isScopedQueueComplete ? dailyClosure.primaryAction.label : nextTrainingQueue.primaryAction.label
  const secondaryAction = isActiveRecallProgress || isReviewDueProgress
    ? { label: '回到复习计划', to: '/study' }
    : isDailyPlanProgress
      ? { label: '回到学习计划', to: '/study' }
    : isResumeDraftProgress
      ? { label: '回到学习计划', to: '/study' }
    : isAbilityGapProgress
      ? { label: '回到路线图', to: '/routes' }
      : isExperiencePlaybookProgress
        ? { label: '回到面经场景', to: '/experiences' }
      : isNextTrainingProgress
        ? { label: '回到学习中心', to: '/study' }
      : isInterviewRetrospectiveProgress
        ? { label: '回到学习中心', to: '/study' }
      : isInterviewBriefProgress
        ? { label: '回到学习中心', to: '/study' }
    : isPaceCoachProgress
      ? { label: '回到学习中心', to: '/study' }
    : isFilteredListProgress
      ? { label: '回到题库', to: '/banks' }
    : isFirstRunRepairCleared || isFirstRunRehearsalCleared
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
              if (activeScopedQueueProgress) {
                activeScopedQueueProgress.onContinue()
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
              shouldShowScopedQueueProgress
                ? `${scopedQueueMetricLabel} ${scopedQueueProgress.answeredCount} / ${scopedQueueProgress.totalCount}`
                : `完成率 ${dailyClosure.completionRate}%`
            }
          >
            {shouldShowScopedQueueProgress ? (
              <>
                <span>{scopedQueueMetricLabel}</span>
                <strong>{scopedQueueProgress.answeredCount} / {scopedQueueProgress.totalCount}</strong>
                <small>
                  {isActiveRecallProgress
                    ? '主动回忆题'
                    : isReviewDueProgress
                    ? '到期复习题'
                    : isDailyPlanProgress
                      ? '今日计划题'
                    : isResumeDraftProgress
                      ? '草稿题'
                    : isAbilityGapProgress
                      ? '短板题'
                    : isExperiencePlaybookProgress
                      ? '高压题'
                    : isNextTrainingProgress
                      ? '风险题'
                    : isInterviewRetrospectiveProgress
                      ? '低分题'
                    : isInterviewBriefProgress
                      ? '面试简报题'
                    : isPaceCoachProgress
                      ? '配速题'
                    : isFilteredListProgress
                      ? '筛选题'
                    : isFirstRunRepairProgress ? '首练风险题' : isFirstRunRehearsalProgress ? '首练过线题' : '本轮高频题'}
                </small>
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
