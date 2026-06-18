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
  buildPracticeSessionAdvanceGate,
  buildPracticeSessionActionPriorities,
  buildPracticeSessionDailyCompletion,
  buildPracticeSessionAbilityRadar,
  buildPracticeSessionEvidenceGaps,
  buildPracticeSessionFirstQuestionRehearsal,
  buildPracticeSessionFirstQuestionRubric,
  buildPracticeSessionFollowUpDefense,
  buildPracticeSessionInterviewerDecision,
  buildPracticeSessionLaunchChecklist,
  buildPracticeSessionLaunchPacket,
  buildPracticeSessionMaterialVault,
  buildPracticeSessionMistakeLedger,
  buildPracticeSessionNextTrainingQueue,
  buildPracticeSessionPassEvidence,
  buildPracticeSessionPassGate,
  buildPracticeSessionPressureProbes,
  buildPracticeSessionRecoveryAcceptance,
  buildPracticeSessionReplayChecklist,
  buildPracticeSessionReplayCards,
  buildPracticeSessionReport,
  buildPracticeSessionReportMarkdown,
  buildPracticeSessionReceiptAcceptance,
  buildPracticeSessionRetryDrafts,
  buildPracticeSessionRiskGuardrails,
  buildPracticeSessionScheduleChecklist,
  buildPracticeSessionScriptCommand,
  buildPracticeSessionTrainingContract,
  buildPracticeSessionTrainingReceipt,
  buildPracticeSessionTrainingSchedule,
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
  const sessionRecoveryAcceptance = useMemo(
    () => buildPracticeSessionRecoveryAcceptance(queue, progress),
    [progress, queue],
  )
  const sessionAbilityRadar = useMemo(
    () => buildPracticeSessionAbilityRadar(queue, progress),
    [progress, queue],
  )
  const sessionInterviewerDecision = useMemo(
    () => buildPracticeSessionInterviewerDecision(queue, progress),
    [progress, queue],
  )
  const sessionActionPriorities = useMemo(
    () => buildPracticeSessionActionPriorities(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionEvidenceGaps = useMemo(
    () => buildPracticeSessionEvidenceGaps(queue, progress),
    [progress, queue],
  )
  const sessionReplayCards = useMemo(
    () => buildPracticeSessionReplayCards(queue, progress),
    [progress, queue],
  )
  const sessionReplayChecklist = useMemo(
    () => buildPracticeSessionReplayChecklist(queue, progress),
    [progress, queue],
  )
  const sessionPressureProbes = useMemo(
    () => buildPracticeSessionPressureProbes(queue, progress),
    [progress, queue],
  )
  const sessionRiskGuardrails = useMemo(
    () => buildPracticeSessionRiskGuardrails(queue, progress),
    [progress, queue],
  )
  const sessionRetryDrafts = useMemo(
    () => buildPracticeSessionRetryDrafts(queue, progress),
    [progress, queue],
  )
  const sessionPassGate = useMemo(
    () => buildPracticeSessionPassGate(queue, progress),
    [progress, queue],
  )
  const sessionPassEvidence = useMemo(
    () => buildPracticeSessionPassEvidence(queue, progress),
    [progress, queue],
  )
  const sessionTrainingContract = useMemo(
    () => buildPracticeSessionTrainingContract(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionTrainingSchedule = useMemo(
    () => buildPracticeSessionTrainingSchedule(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionScheduleChecklist = useMemo(
    () => buildPracticeSessionScheduleChecklist(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionTrainingReceipt = useMemo(
    () => buildPracticeSessionTrainingReceipt(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionReceiptAcceptance = useMemo(
    () => buildPracticeSessionReceiptAcceptance(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionAdvanceGate = useMemo(
    () => buildPracticeSessionAdvanceGate(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionLaunchPacket = useMemo(
    () => buildPracticeSessionLaunchPacket(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionLaunchChecklist = useMemo(
    () => buildPracticeSessionLaunchChecklist(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionFirstQuestionRehearsal = useMemo(
    () => buildPracticeSessionFirstQuestionRehearsal(queue, progress, progress.updatedAt),
    [progress, queue],
  )
  const sessionFirstQuestionRubric = useMemo(
    () => buildPracticeSessionFirstQuestionRubric(queue, progress, progress.updatedAt),
    [progress, queue],
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

      <div
        className={`practice-session-report-recovery-acceptance status-${sessionRecoveryAcceptance.status}`}
        aria-label="本轮错因验收"
      >
        <div className="practice-session-report-recovery-acceptance-head">
          <span>本轮错因验收</span>
          <strong>{sessionRecoveryAcceptance.title}</strong>
          <small>{sessionRecoveryAcceptance.summary}</small>
        </div>
        <div className="practice-session-report-recovery-acceptance-metrics">
          <div>
            <span>通过</span>
            <strong>{sessionRecoveryAcceptance.passedCount} / {sessionRecoveryAcceptance.totalCount}</strong>
          </div>
          <div>
            <span>失败</span>
            <strong>{sessionRecoveryAcceptance.failedQuestionIds.length}</strong>
          </div>
          <div>
            <span>待复测</span>
            <strong>{sessionRecoveryAcceptance.pendingQuestionIds.length}</strong>
          </div>
        </div>
        <Button
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => onNavigate(sessionRecoveryAcceptance.primaryAction.to)}
        >
          {sessionRecoveryAcceptance.primaryAction.label}
        </Button>
      </div>

      <div
        className={`practice-session-report-ability-radar status-${sessionAbilityRadar.status}`}
        aria-label="本轮薄弱能力雷达"
      >
        <div className="practice-session-report-ability-radar-head">
          <span>本轮薄弱能力雷达</span>
          <strong>{sessionAbilityRadar.title}</strong>
          <small>{sessionAbilityRadar.summary}</small>
        </div>
        <div className="practice-session-report-ability-radar-focus">
          <div>
            <span>最弱维度</span>
            <strong>{sessionAbilityRadar.weakestItem?.label ?? '暂无'}</strong>
          </div>
          <div>
            <span>平均分</span>
            <strong>{sessionAbilityRadar.weakestItem?.averageScore ?? 0}</strong>
          </div>
          <div>
            <span>影响题</span>
            <strong>{sessionAbilityRadar.weakestItem?.lowScoreQuestionIds.length ?? 0}</strong>
          </div>
        </div>
        {sessionAbilityRadar.items.length === 0 ? (
          <p>暂无维度明细。先完成一次模拟面试后，战报会自动生成能力雷达。</p>
        ) : (
          <div className="practice-session-report-ability-radar-items">
            {sessionAbilityRadar.items.map(item => (
              <div key={item.key}>
                <span>维度：{item.label}</span>
                <strong>均分 {item.averageScore}</strong>
                <small>
                  {item.lowScoreQuestionIds.length > 0
                    ? `${item.lowScoreQuestionIds.length} 道低分题`
                    : '本轮已过线'}
                </small>
              </div>
            ))}
          </div>
        )}
        <Button
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={() => onNavigate(sessionAbilityRadar.primaryAction.to)}
        >
          {sessionAbilityRadar.primaryAction.label}
        </Button>
      </div>

      <div
        className={`practice-session-report-interviewer-decision status-${sessionInterviewerDecision.status}`}
        aria-label="本轮面试官决策卡"
      >
        <div className="practice-session-report-interviewer-decision-head">
          <span>本轮面试官决策卡</span>
          <strong>{sessionInterviewerDecision.verdict}</strong>
          <small>{sessionInterviewerDecision.summary}</small>
        </div>
        <div className="practice-session-report-interviewer-decision-evidence">
          {sessionInterviewerDecision.evidence.map(item => (
            <div key={item.key}>
              <span>{item.label}</span>
              <strong>{item.key === 'answered' ? item.value.replace(' / ', '/') : item.value}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        <div className="practice-session-report-interviewer-decision-blockers">
          <span>阻断项</span>
          {(sessionInterviewerDecision.blockers.length > 0
            ? sessionInterviewerDecision.blockers
            : ['暂无硬阻断']).map(blocker => (
              <strong key={blocker}>{blocker}</strong>
            ))}
        </div>
        <Button
          size="small"
          icon={<WarningOutlined />}
          onClick={() => onNavigate(sessionInterviewerDecision.primaryAction.to)}
        >
          {sessionInterviewerDecision.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-action-priorities" aria-label="本轮行动优先级">
        <div className="practice-session-report-action-priorities-head">
          <span>本轮行动优先级</span>
          <strong>{sessionActionPriorities.title}</strong>
          <small>{sessionActionPriorities.summary}</small>
        </div>
        {sessionActionPriorities.items.length === 0 ? (
          <p>等待建立行动队列。先完成一次模拟面试后，系统会自动排序本轮动作。</p>
        ) : (
          <div className="practice-session-report-action-priorities-list">
            {sessionActionPriorities.items.map((item, index) => (
              <article key={item.id}>
                <em>{index + 1}</em>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.reason}</span>
                  <small>{item.description}</small>
                </div>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => onNavigate(sessionActionPriorities.primaryAction.to)}
        >
          {sessionActionPriorities.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-evidence-gaps" aria-label="本轮证据缺口">
        <div className="practice-session-report-evidence-gaps-head">
          <span>本轮证据缺口</span>
          <strong>{sessionEvidenceGaps.title}</strong>
          <small>{sessionEvidenceGaps.summary}</small>
        </div>
        {sessionEvidenceGaps.items.length === 0 ? (
          <p>等待生成证据缺口。先完成一次模拟面试后，系统会自动定位会被追问的证据漏洞。</p>
        ) : (
          <div className="practice-session-report-evidence-gaps-list">
            {sessionEvidenceGaps.items.map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.criterionLabel} {item.score} 分</span>
                </div>
                <small>{item.interviewerProbe}</small>
                <em>{item.repairHint}</em>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionEvidenceGaps.status === 'blocked'}
          icon={<WarningOutlined />}
          onClick={() => onNavigate(sessionEvidenceGaps.primaryAction.to)}
        >
          {sessionEvidenceGaps.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-replay-cards" aria-label="本轮 60 秒复述卡">
        <div className="practice-session-report-replay-cards-head">
          <span>本轮 60 秒复述卡</span>
          <strong>{sessionReplayCards.title}</strong>
          <small>{sessionReplayCards.summary}</small>
        </div>
        {sessionReplayCards.items.length === 0 ? (
          <p>等待生成复述卡。先完成一次模拟面试后，系统会自动生成可开口的 60 秒重答脚本。</p>
        ) : (
          <div className="practice-session-report-replay-cards-list">
            {sessionReplayCards.items.map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.focus}</span>
                </div>
                <small>{item.openingLine}</small>
                <small>{item.evidenceLine}</small>
                <em>{item.boundaryLine}</em>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => onNavigate(sessionReplayCards.primaryAction.to)}
        >
          {sessionReplayCards.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-replay-checklist" aria-label="本轮复述验收清单">
        <div className="practice-session-report-replay-checklist-head">
          <span>本轮复述验收清单</span>
          <strong>{sessionReplayChecklist.title}</strong>
          <small>{sessionReplayChecklist.summary}</small>
        </div>
        {sessionReplayChecklist.items.length === 0 ? (
          <p>等待生成验收清单。先完成一次模拟面试并生成复述卡后，系统会给出提交前自查标准。</p>
        ) : (
          <div className="practice-session-report-replay-checklist-list">
            {sessionReplayChecklist.items.map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.target}</span>
                </div>
                <small>{item.description}</small>
                <em>{item.failureSignal}</em>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => onNavigate(sessionReplayChecklist.primaryAction.to)}
        >
          {sessionReplayChecklist.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-pressure-probes" aria-label="本轮压力追问卡">
        <div className="practice-session-report-pressure-probes-head">
          <span>本轮压力追问卡</span>
          <strong>{sessionPressureProbes.title}</strong>
          <small>{sessionPressureProbes.summary}</small>
        </div>
        {sessionPressureProbes.items.length === 0 ? (
          <p>等待生成压力追问。先完成一次模拟面试并生成复述卡后，系统会给出现场连问脚本。</p>
        ) : (
          <div className="practice-session-report-pressure-probes-list">
            {sessionPressureProbes.items.map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.title}</span>
                </div>
                <small>{item.probe}</small>
                <em>{item.riskSignal}</em>
                <b>{item.answerGuide}</b>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => onNavigate(sessionPressureProbes.primaryAction.to)}
        >
          {sessionPressureProbes.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-risk-guardrails" aria-label="本轮失分禁区">
        <div className="practice-session-report-risk-guardrails-head">
          <span>本轮失分禁区</span>
          <strong>{sessionRiskGuardrails.title}</strong>
          <small>{sessionRiskGuardrails.summary}</small>
        </div>
        {sessionRiskGuardrails.items.length === 0 ? (
          <p>等待生成失分禁区。先完成一次模拟面试并生成压力追问后，系统会给出重答避坑清单。</p>
        ) : (
          <div className="practice-session-report-risk-guardrails-list">
            {sessionRiskGuardrails.items.map(item => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <small>{item.avoid}</small>
                <em>{item.reason}</em>
                <b>{item.replacement}</b>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          danger={sessionRiskGuardrails.status === 'warning'}
          icon={<WarningOutlined />}
          onClick={() => onNavigate(sessionRiskGuardrails.primaryAction.to)}
        >
          {sessionRiskGuardrails.primaryAction.label}
        </Button>
      </div>

      <div className="practice-session-report-retry-drafts" aria-label="本轮二次提交稿">
        <div className="practice-session-report-retry-drafts-head">
          <span>本轮二次提交稿</span>
          <strong>{sessionRetryDrafts.title}</strong>
          <small>{sessionRetryDrafts.summary}</small>
        </div>
        <div className="practice-session-report-retry-drafts-labels" aria-hidden="true">
          <span>结论句</span>
          <span>证据句</span>
          <span>边界句</span>
          <span>收束句</span>
        </div>
        {sessionRetryDrafts.items.length === 0 ? (
          <p>等待生成二次提交稿。先完成一次模拟面试并生成复述卡后，系统会给出可直接重答的提交稿。</p>
        ) : (
          <div className="practice-session-report-retry-drafts-list">
            {sessionRetryDrafts.items.map(item => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <small>{item.conclusionLine}</small>
                <small>{item.evidenceLine}</small>
                <em>{item.boundaryLine}</em>
                <b>{item.closingLine}</b>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          icon={<HighlightOutlined />}
          onClick={() => onNavigate(sessionRetryDrafts.primaryAction.to)}
        >
          {sessionRetryDrafts.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-pass-gate status-${sessionPassGate.status}`} aria-label="本轮通过门槛">
        <div className="practice-session-report-pass-gate-head">
          <span>本轮通过门槛</span>
          <strong>{sessionPassGate.title}</strong>
          <small>{sessionPassGate.summary}</small>
        </div>
        {sessionPassGate.items.length === 0 ? (
          <p>等待生成通过门槛。先完成一次模拟面试后，系统会判断本轮是否可以进入下一轮。</p>
        ) : (
          <div className="practice-session-report-pass-gate-list">
            {sessionPassGate.items.map(item => (
              <article key={item.id} className={`status-${item.status}`}>
                <div>
                  <strong>{item.label}</strong>
                  <em>{item.status === 'ready' ? '已通过' : '待修复'}</em>
                </div>
                <span>{item.target}</span>
                <small>{item.current}</small>
                <b>{item.action}</b>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionPassGate.status === 'blocked'}
          icon={sessionPassGate.status === 'blocked' ? <WarningOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionPassGate.primaryAction.to)}
        >
          {sessionPassGate.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-pass-evidence status-${sessionPassEvidence.status}`} aria-label="本轮过线证据包">
        <div className="practice-session-report-pass-evidence-head">
          <span>本轮过线证据包</span>
          <strong>{sessionPassEvidence.title}</strong>
          <small>{sessionPassEvidence.summary}</small>
        </div>
        {sessionPassEvidence.items.length === 0 ? (
          <p>等待生成过线证据包。先完成一次模拟面试后，系统会沉淀本轮能否过线的关键证据。</p>
        ) : (
          <div className="practice-session-report-pass-evidence-list">
            {sessionPassEvidence.items.map(item => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <small>{item.explanation}</small>
                <b>{item.action}</b>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionPassEvidence.status === 'blocked'}
          icon={sessionPassEvidence.status === 'blocked' ? <WarningOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionPassEvidence.primaryAction.to)}
        >
          {sessionPassEvidence.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-training-contract status-${sessionTrainingContract.status}`} aria-label="下一轮训练契约">
        <div className="practice-session-report-training-contract-head">
          <span>下一轮训练契约</span>
          <strong>{sessionTrainingContract.title}</strong>
          <small>{sessionTrainingContract.summary}</small>
        </div>
        {sessionTrainingContract.items.length === 0 ? (
          <p>等待生成训练契约。先完成一次模拟面试后，系统会给出下一轮目标、题组和验收口径。</p>
        ) : (
          <div className="practice-session-report-training-contract-list">
            {sessionTrainingContract.items.map(item => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionTrainingContract.status === 'repair'}
          icon={sessionTrainingContract.status === 'repair' ? <ReloadOutlined /> : <PlayCircleOutlined />}
          onClick={() => onNavigate(sessionTrainingContract.primaryAction.to)}
        >
          {sessionTrainingContract.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-training-schedule status-${sessionTrainingSchedule.status}`} aria-label="下一轮训练日程">
        <div className="practice-session-report-training-schedule-head">
          <div>
            <span>下一轮训练日程</span>
            <strong>{sessionTrainingSchedule.title}</strong>
            <small>{sessionTrainingSchedule.summary}</small>
          </div>
          <em>{sessionTrainingSchedule.totalMinutes} 分钟</em>
        </div>
        {sessionTrainingSchedule.items.length === 0 ? (
          <p>等待生成训练日程。先完成一次模拟面试后，系统会把训练契约拆成预热、作答和验收复盘。</p>
        ) : (
          <div className="practice-session-report-training-schedule-list">
            {sessionTrainingSchedule.items.map(item => (
              <article key={item.id}>
                <div>
                  <span>{item.timeRange}</span>
                  <b>{item.phase}</b>
                </div>
                <strong>{item.title}</strong>
                <p>{item.task}</p>
                <small>{item.acceptance}</small>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionTrainingSchedule.status === 'repair'}
          icon={sessionTrainingSchedule.status === 'repair' ? <ReloadOutlined /> : <PlayCircleOutlined />}
          onClick={() => onNavigate(sessionTrainingSchedule.primaryAction.to)}
        >
          {sessionTrainingSchedule.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-schedule-checklist status-${sessionScheduleChecklist.status}`} aria-label="训练日程打卡清单">
        <div className="practice-session-report-schedule-checklist-head">
          <div>
            <span>训练日程打卡清单</span>
            <strong>{sessionScheduleChecklist.title}</strong>
            <small>{sessionScheduleChecklist.summary}</small>
          </div>
        </div>
        {sessionScheduleChecklist.items.length === 0 ? (
          <p>等待生成打卡清单。先生成下一轮训练日程后，系统会把每个时间块转成可核销证据。</p>
        ) : (
          <div className="practice-session-report-schedule-checklist-list">
            {sessionScheduleChecklist.items.map(item => (
              <article key={item.id}>
                <div>
                  <span>{item.phase}</span>
                  <strong>{item.checkLabel}</strong>
                </div>
                <dl>
                  <dt>完成口径</dt>
                  <dd>{item.completionRule}</dd>
                  <dt>证据模板</dt>
                  <dd>{item.evidenceTemplate}</dd>
                  <dt>复盘问题</dt>
                  <dd>{item.reviewQuestion}</dd>
                </dl>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionScheduleChecklist.status === 'repair'}
          icon={sessionScheduleChecklist.status === 'repair' ? <ReloadOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionScheduleChecklist.primaryAction.to)}
        >
          {sessionScheduleChecklist.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-training-receipt status-${sessionTrainingReceipt.status}`} aria-label="训练回执模板">
        <div className="practice-session-report-training-receipt-head">
          <div>
            <span>训练回执模板</span>
            <strong>{sessionTrainingReceipt.title}</strong>
            <small>{sessionTrainingReceipt.summary}</small>
          </div>
        </div>
        {sessionTrainingReceipt.items.length === 0 ? (
          <p>等待生成训练回执。先完成一次模拟面试并生成打卡清单后，系统会给出可填写模板。</p>
        ) : (
          <div className="practice-session-report-training-receipt-list">
            {sessionTrainingReceipt.items.map(item => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.prompt}</span>
                <small>{item.example}</small>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionTrainingReceipt.status === 'repair'}
          icon={sessionTrainingReceipt.status === 'repair' ? <ReloadOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionTrainingReceipt.primaryAction.to)}
        >
          {sessionTrainingReceipt.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-receipt-acceptance status-${sessionReceiptAcceptance.status}`} aria-label="回执验收卡">
        <div className="practice-session-report-receipt-acceptance-head">
          <div>
            <span>回执验收卡</span>
            <strong>{sessionReceiptAcceptance.title}</strong>
            <small>{sessionReceiptAcceptance.summary}</small>
          </div>
        </div>
        {sessionReceiptAcceptance.items.length === 0 ? (
          <p>等待验收训练回执。先生成训练回执模板后，系统会给出进入下一轮前的检查点。</p>
        ) : (
          <div className="practice-session-report-receipt-acceptance-list">
            {sessionReceiptAcceptance.items.map(item => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.target}</span>
                <small>{item.check}</small>
                <em>{item.fallbackAction}</em>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionReceiptAcceptance.status === 'repair'}
          icon={sessionReceiptAcceptance.status === 'repair' ? <ReloadOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionReceiptAcceptance.primaryAction.to)}
        >
          {sessionReceiptAcceptance.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-advance-gate status-${sessionAdvanceGate.status}`} aria-label="下一轮准入闸门">
        <div className="practice-session-report-advance-gate-head">
          <div>
            <span>下一轮准入闸门</span>
            <strong>{sessionAdvanceGate.title}</strong>
            <small>{sessionAdvanceGate.summary}</small>
          </div>
        </div>
        {sessionAdvanceGate.items.length === 0 ? (
          <p>等待建立准入样本。先完成训练回执和验收卡后，系统会给出进入下一轮的裁决。</p>
        ) : (
          <div className="practice-session-report-advance-gate-list">
            {sessionAdvanceGate.items.map(item => (
              <article key={item.id} className={`state-${item.state}`}>
                <div>
                  <strong>{item.label}</strong>
                  <em>{item.state === 'passed' ? '已通过' : '未通过'}</em>
                </div>
                <span>{item.condition}</span>
                <small>{item.action}</small>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionAdvanceGate.status === 'blocked'}
          icon={sessionAdvanceGate.status === 'blocked' ? <ReloadOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionAdvanceGate.primaryAction.to)}
        >
          {sessionAdvanceGate.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-launch-packet status-${sessionLaunchPacket.status}`} aria-label="下一轮启动包">
        <div className="practice-session-report-launch-packet-head">
          <div>
            <span>下一轮启动包</span>
            <strong>{sessionLaunchPacket.title}</strong>
            <small>{sessionLaunchPacket.summary}</small>
          </div>
        </div>
        {sessionLaunchPacket.items.length === 0 ? (
          <p>等待建立启动样本。先完成准入闸门后，系统会给出下一步启动动作。</p>
        ) : (
          <div className="practice-session-report-launch-packet-list">
            {sessionLaunchPacket.items.map(item => (
              <article key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.instruction}</span>
                <small>{item.completionRule}</small>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionLaunchPacket.status === 'repair'}
          icon={sessionLaunchPacket.status === 'repair' ? <ReloadOutlined /> : <PlayCircleOutlined />}
          onClick={() => onNavigate(sessionLaunchPacket.primaryAction.to)}
        >
          {sessionLaunchPacket.primaryAction.label}
        </Button>
      </div>

      <div className={`practice-session-report-launch-checklist status-${sessionLaunchChecklist.status}`} aria-label="启动执行清单">
        <div className="practice-session-report-launch-checklist-head">
          <div>
            <span>启动执行清单</span>
            <strong>{sessionLaunchChecklist.title}</strong>
            <small>{sessionLaunchChecklist.summary}</small>
          </div>
        </div>
        {sessionLaunchChecklist.items.length === 0 ? (
          <p>等待生成启动执行清单。先生成下一轮启动包后，系统会把启动动作转成可核销证据。</p>
        ) : (
          <div className="practice-session-report-launch-checklist-list">
            {sessionLaunchChecklist.items.map(item => (
              <article key={item.id}>
                <div>
                  <span>{item.phase}</span>
                  <strong>{item.completionRule}</strong>
                </div>
                <dl>
                  <dt>证据模板</dt>
                  <dd>{item.evidenceTemplate}</dd>
                  <dt>复盘问题</dt>
                  <dd>{item.reviewQuestion}</dd>
                </dl>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionLaunchChecklist.status === 'repair'}
          icon={sessionLaunchChecklist.status === 'repair' ? <ReloadOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionLaunchChecklist.primaryAction.to)}
        >
          {sessionLaunchChecklist.primaryAction.label}
        </Button>
      </div>

      <div
        className={`practice-session-report-first-rehearsal status-${sessionFirstQuestionRehearsal.status}`}
        aria-label="首题预演卡"
      >
        <div className="practice-session-report-first-rehearsal-head">
          <div>
            <span>首题预演卡</span>
            <strong>{sessionFirstQuestionRehearsal.title}</strong>
            <small>{sessionFirstQuestionRehearsal.summary}</small>
          </div>
        </div>
        <div className="practice-session-report-first-rehearsal-body">
          <article>
            <span>首题</span>
            <strong>{sessionFirstQuestionRehearsal.questionTitle}</strong>
            <small>{sessionFirstQuestionRehearsal.reason}</small>
          </article>
          <dl>
            <dt>开场提示</dt>
            <dd>{sessionFirstQuestionRehearsal.openingPrompt}</dd>
            <dt>通过信号</dt>
            <dd>{sessionFirstQuestionRehearsal.passSignal}</dd>
            <dt>证据要求</dt>
            <dd>{sessionFirstQuestionRehearsal.evidenceRequirement}</dd>
          </dl>
        </div>
        <Button
          size="small"
          type="primary"
          danger={sessionFirstQuestionRehearsal.status === 'repair'}
          icon={sessionFirstQuestionRehearsal.status === 'repair' ? <ReloadOutlined /> : <PlayCircleOutlined />}
          onClick={() => onNavigate(sessionFirstQuestionRehearsal.primaryAction.to)}
        >
          {sessionFirstQuestionRehearsal.primaryAction.label}
        </Button>
      </div>

      <div
        className={`practice-session-report-first-rubric status-${sessionFirstQuestionRubric.status}`}
        aria-label="首题验收尺"
      >
        <div className="practice-session-report-first-rubric-head">
          <div>
            <span>首题验收尺</span>
            <strong>{sessionFirstQuestionRubric.title}</strong>
            <small>{sessionFirstQuestionRubric.summary}</small>
          </div>
        </div>
        {sessionFirstQuestionRubric.items.length === 0 ? (
          <p>等待首题验收尺。先生成首题预演卡后，系统会给出 4 条验收口径。</p>
        ) : (
          <div className="practice-session-report-first-rubric-list">
            {sessionFirstQuestionRubric.items.map(item => (
              <article key={item.id}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.target}</strong>
                </div>
                <dl>
                  <dt>检查口径</dt>
                  <dd>{item.check}</dd>
                  <dt>证据</dt>
                  <dd>{item.evidence}</dd>
                </dl>
              </article>
            ))}
          </div>
        )}
        <Button
          size="small"
          type="primary"
          danger={sessionFirstQuestionRubric.status === 'repair'}
          icon={sessionFirstQuestionRubric.status === 'repair' ? <ReloadOutlined /> : <CheckCircleOutlined />}
          onClick={() => onNavigate(sessionFirstQuestionRubric.primaryAction.to)}
        >
          {sessionFirstQuestionRubric.primaryAction.label}
        </Button>
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
