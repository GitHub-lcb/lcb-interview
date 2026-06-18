import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  HighlightOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Button, message } from 'antd'
import { useMemo } from 'react'
import type {
  PracticeQueueItem,
  PracticeSessionReport,
  PracticeSessionReportAction,
  PracticeSessionRepairAction,
  StudyProgress,
} from '../types'
import { formatNextTrainingQueueItemMeta } from '../utils/nextTrainingQueue'
import {
  buildPracticeSessionDailyCompletion,
  buildPracticeSessionFollowUpDefense,
  buildPracticeSessionMaterialVault,
  buildPracticeSessionMistakeLedger,
  buildPracticeSessionNextTrainingQueue,
  buildPracticeSessionReport,
  buildPracticeSessionReportMarkdown,
  buildPracticeSessionScriptCommand,
} from '../utils/practiceSessionReport'
import { buildInterviewRecoveryPlan } from '../utils/interviewRecoveryPlan'

interface PracticeSessionReportPanelProps {
  queue: PracticeQueueItem[]
  progress: StudyProgress
  onNavigate: (to: string) => void
  onUseRepairAction?: (action: PracticeSessionRepairAction) => void
}

const levelLabels: Record<PracticeSessionReport['level'], string> = {
  empty: '待开始',
  'in-progress': '推进中',
  risk: '需补弱',
  passed: '已通过',
}

const actionIcons: Record<PracticeSessionReportAction['kind'], JSX.Element> = {
  start: <PlayCircleOutlined />,
  repair: <ReloadOutlined />,
  continue: <ArrowRightOutlined />,
  review: <CheckCircleOutlined />,
}

export default function PracticeSessionReportPanel({
  queue,
  progress,
  onNavigate,
  onUseRepairAction,
}: PracticeSessionReportPanelProps) {
  const report = useMemo(
    () => buildPracticeSessionReport(queue, progress),
    [progress, queue],
  )
  const nextTrainingQueue = useMemo(
    () => buildPracticeSessionNextTrainingQueue(queue, progress, progress.updatedAt, 3),
    [progress, queue],
  )
  const dailyClosure = useMemo(
    () => buildPracticeSessionDailyCompletion(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionMaterialVault = useMemo(
    () => buildPracticeSessionMaterialVault(queue, progress),
    [progress, queue],
  )
  const sessionFollowUpDefense = useMemo(
    () => buildPracticeSessionFollowUpDefense(queue, progress),
    [progress, queue],
  )
  const sessionScriptCommand = useMemo(
    () => buildPracticeSessionScriptCommand(queue, progress),
    [progress, queue],
  )
  const sessionMistakeLedger = useMemo(
    () => buildPracticeSessionMistakeLedger(queue, progress),
    [progress, queue],
  )
  const sessionRecoveryPlan = useMemo(
    () => buildInterviewRecoveryPlan(sessionMistakeLedger),
    [sessionMistakeLedger],
  )
  const dailyClosureRiskCount = dailyClosure.reviewDebtCount + dailyClosure.weakCount

  const handleCopyReport = async () => {
    const markdown = buildPracticeSessionReportMarkdown(queue, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('本轮模拟面试战报已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 战报')
  }

  const handleRepairAction = (action: PracticeSessionRepairAction) => {
    if (onUseRepairAction) {
      onUseRepairAction(action)
      return
    }
    onNavigate(action.to)
  }

  return (
    <section className={`practice-session-report-panel level-${report.level}`} aria-label="本轮模拟面试战报">
      <div className="practice-session-report-head">
        <div>
          <div className="dashboard-kicker">
            <BarChartOutlined />
            本轮模拟面试战报
          </div>
          <h3>{report.title}</h3>
          <p>{report.summary}</p>
        </div>
        <div className="practice-session-report-head-actions">
          <span>{levelLabels[report.level]}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReport}>
            复制战报
          </Button>
        </div>
      </div>

      <div className="practice-session-report-metrics">
        {report.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className="practice-session-report-profile" aria-label="队列画像">
        <div className="practice-session-report-profile-head">
          <span>队列画像</span>
          <small>{report.queueProfile.isEmpty ? '待建立' : '本轮入口'}</small>
        </div>
        {report.queueProfile.isEmpty ? (
          <p>暂无队列画像。先从学习计划、薄弱题或题库进入模拟面试。</p>
        ) : (
          <>
            <div className="practice-session-report-profile-main">
              <span>来源构成</span>
              <strong>{report.queueProfile.sourceSummary}</strong>
            </div>
            <div className="practice-session-report-profile-next">
              <span>下一题</span>
              <strong>{report.queueProfile.nextQuestionTitle}</strong>
              <small>{report.queueProfile.nextQuestionMeta}</small>
            </div>
            <div className="practice-session-report-profile-metrics">
              <div>
                <span>未答</span>
                <strong>{report.queueProfile.unansweredQuestionIds.length}</strong>
              </div>
              <div>
                <span>薄弱</span>
                <strong>{report.queueProfile.weakQuestionIds.length}</strong>
              </div>
            </div>
          </>
        )}
        <Button size="small" icon={<ArrowRightOutlined />} onClick={() => onNavigate(report.queueProfile.queuePath)}>
          进入队列
        </Button>
      </div>

      <div className="practice-session-report-daily-closure" aria-label="今日闭环">
        <div className="practice-session-report-daily-closure-head">
          <div>
            <span>今日闭环</span>
            <strong>{dailyClosure.title}</strong>
            <small>{dailyClosure.summary}</small>
          </div>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => onNavigate(dailyClosure.primaryAction.to)}
          >
            {dailyClosure.primaryAction.label}
          </Button>
        </div>
        <div className="practice-session-report-daily-closure-metrics">
          <div>
            <span>完成率</span>
            <strong>{dailyClosure.completionRate}%</strong>
          </div>
          <div>
            <span>风险</span>
            <strong>{dailyClosureRiskCount}</strong>
          </div>
          <div>
            <span>模拟</span>
            <strong>{dailyClosure.interviewTodayCount}</strong>
          </div>
        </div>
      </div>

      <div className="practice-session-report-material-vault" aria-label="本轮高分素材">
        <div className="practice-session-report-material-vault-head">
          <div>
            <span>本轮高分素材</span>
            <small>{sessionMaterialVault.summary}</small>
          </div>
          <Button
            size="small"
            icon={<HighlightOutlined />}
            onClick={() => onNavigate(sessionMaterialVault.primaryAction.to)}
          >
            {sessionMaterialVault.primaryAction.label}
          </Button>
        </div>
        {sessionMaterialVault.snippets.length === 0 ? (
          <p>暂无本轮高分素材。完成 80 分以上模拟回答后，战报会自动沉淀可复用表达。</p>
        ) : (
          <div className="practice-session-report-material-vault-list">
            {sessionMaterialVault.snippets.slice(0, 3).map(snippet => (
              <button key={snippet.id} type="button" onClick={() => onNavigate(snippet.to)}>
                <strong>{snippet.title}</strong>
                <span>{snippet.label} · {snippet.score} 分</span>
                <small>{snippet.content}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="practice-session-report-follow-up-defense" aria-label="本轮追问防线">
        <div className="practice-session-report-follow-up-defense-head">
          <div>
            <span>本轮追问防线</span>
            <small>{sessionFollowUpDefense.summary}</small>
          </div>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => onNavigate(sessionFollowUpDefense.primaryAction.to)}
          >
            {sessionFollowUpDefense.primaryAction.label}
          </Button>
        </div>
        {sessionFollowUpDefense.items.length === 0 ? (
          <p>暂无本轮追问防线。完成一次模拟面试后，战报会自动生成可防守追问。</p>
        ) : (
          <div className="practice-session-report-follow-up-defense-list">
            {sessionFollowUpDefense.items.slice(0, 3).map(item => (
              <button key={item.id} type="button" onClick={() => onNavigate(item.to)}>
                <strong>{item.title}</strong>
                <span>{item.criterionLabel} · {item.score} 分</span>
                <small>{item.pressurePoint}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="practice-session-report-script-command" aria-label="本轮脚本总控">
        <div className="practice-session-report-script-command-head">
          <div>
            <span>本轮脚本总控</span>
            <small>{sessionScriptCommand.summary}</small>
          </div>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => onNavigate(sessionScriptCommand.primaryAction.to)}
          >
            {sessionScriptCommand.primaryAction.label}
          </Button>
        </div>
        {sessionScriptCommand.items.length === 0 ? (
          <p>暂无本轮脚本总控。先建立练习队列，再完成本题面试官脚本。</p>
        ) : (
          <div className="practice-session-report-script-command-list">
            {sessionScriptCommand.items.slice(0, 3).map(item => (
              <button key={item.questionId} type="button" onClick={() => onNavigate(item.to)}>
                <strong>{item.title}</strong>
                <span>{item.scriptTitle} · {item.passedCount} / {item.totalSteps}</span>
                <small>{item.nextPrompt || item.summary}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="practice-session-report-mistake-ledger" aria-label="本轮错因账本">
        <div className="practice-session-report-mistake-ledger-head">
          <div>
            <span>本轮错因账本</span>
            <small>{sessionMistakeLedger.summary}</small>
          </div>
          <Button
            size="small"
            icon={<WarningOutlined />}
            onClick={() => onNavigate(sessionMistakeLedger.primaryAction.to)}
          >
            {sessionMistakeLedger.primaryAction.label}
          </Button>
        </div>
        <div className="practice-session-report-mistake-ledger-metrics">
          <div>
            <span>问题</span>
            <strong>{sessionMistakeLedger.totalProblems}</strong>
          </div>
          <div>
            <span>计划</span>
            <strong>{sessionRecoveryPlan.totalMinutes} 分钟</strong>
          </div>
        </div>
        {sessionMistakeLedger.items.length === 0 ? (
          <p>暂无本轮错因账本。完成一次模拟面试后，战报会自动定位错因。</p>
        ) : (
          <div className="practice-session-report-mistake-ledger-list">
            {sessionMistakeLedger.items.slice(0, 3).map(item => (
              <button key={item.id} type="button" onClick={() => onNavigate(item.to)}>
                <strong>{item.label}</strong>
                <span>{item.averageScore} 平均分 · {item.affectedQuestionIds.length} 道题</span>
                <small>{item.latestQuestionTitle}</small>
              </button>
            ))}
          </div>
        )}
        <div className="practice-session-report-mistake-ledger-plan">
          <span>{sessionRecoveryPlan.title}</span>
          <small>{sessionRecoveryPlan.steps[0]?.description ?? sessionRecoveryPlan.summary}</small>
        </div>
      </div>

      <div className="practice-session-report-next-training" aria-label="下一轮训练">
        <div className="practice-session-report-next-training-head">
          <div>
            <span>下一轮训练</span>
            <small>{nextTrainingQueue.summary}</small>
          </div>
          <Button
            size="small"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => onNavigate(nextTrainingQueue.primaryAction.to)}
          >
            {nextTrainingQueue.primaryAction.label}
          </Button>
        </div>
        {nextTrainingQueue.items.length === 0 ? (
          <p>暂无下一轮训练题。先做一次模拟面试或生成今日计划后，系统会自动排下一轮。</p>
        ) : (
          <div className="practice-session-report-next-training-list">
            {nextTrainingQueue.items.map(item => (
              <button key={item.id} type="button" onClick={() => onNavigate(item.to)}>
                <strong>{item.title}</strong>
                <span>{formatNextTrainingQueueItemMeta(item)}</span>
                <small>{item.reason}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {report.repairActions.length > 0 && (
        <div className="practice-session-report-repairs" aria-label="本轮补弱动作">
          <div className="practice-session-report-repairs-head">
            <span>本轮补弱动作</span>
            <small>{report.repairActions.length} 项</small>
          </div>
          {report.repairActions.slice(0, 3).map(action => (
            <article key={`${action.questionId}-${action.criterionLabel}`}>
              <div>
                <strong title={action.title}>{action.title}</strong>
                <span>{action.criterionLabel}</span>
              </div>
              <p>{action.reason}</p>
              <small>{action.action}</small>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRepairAction(action)}>
                去补弱
              </Button>
            </article>
          ))}
        </div>
      )}

      <Button
        className="practice-session-report-action"
        type="primary"
        danger={report.level === 'risk'}
        icon={actionIcons[report.primaryAction.kind]}
        onClick={() => onNavigate(report.primaryAction.to)}
      >
        {report.primaryAction.label}
        <ArrowRightOutlined />
      </Button>
    </section>
  )
}

async function copyMarkdown(markdown: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(markdown)
    return true
  } catch {
    return false
  }
}

function downloadMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '面试'}-本轮模拟面试战报.md`
}
