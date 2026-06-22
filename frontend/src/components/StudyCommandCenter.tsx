import { Button, Progress } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import {
  ArrowRightOutlined,
  CompassOutlined,
  CopyOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildNextTrainingQueue, formatNextTrainingQueueItemMeta } from '../utils/nextTrainingQueue'
import { buildPracticeDraftRecovery } from '../utils/practiceDraftRecovery'
import { buildStudyCommandMarkdown, buildStudyStrategy } from '../utils/studyStrategy'
import type { StudyStrategyAction } from '../types'

function buttonType(action: StudyStrategyAction) {
  return action.tone === 'primary' ? 'primary' : 'default'
}

export default function StudyCommandCenter() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const strategy = useMemo(() => buildStudyStrategy(progress), [progress])
  const nextTrainingQueue = useMemo(() => buildNextTrainingQueue(progress, new Date().toISOString(), 3), [progress])
  const draftRecovery = useMemo(() => buildPracticeDraftRecovery(progress, { limit: 3 }), [progress])

  const handleCopyCommand = async () => {
    const markdown = buildStudyCommandMarkdown(progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('备考指挥中心已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 指挥中心')
  }

  return (
    <section className={`study-command-center level-${strategy.level}`} aria-label="备考指挥中心">
      <div className="command-score-card">
        <div className="command-card-kicker">
          <CompassOutlined />
          备考就绪度
        </div>
        <strong>{strategy.readinessScore}</strong>
        <Progress percent={strategy.readinessScore} showInfo={false} strokeColor="#059669" />
        <span>{strategy.title}</span>
      </div>

      <div className="command-main-card">
        <div className="command-main-header">
          <div>
            <div className="dashboard-kicker">智能备考指挥中心</div>
            <h2>{strategy.primaryRisk.title}</h2>
            <p>{strategy.summary}</p>
          </div>
          <div className="command-main-actions">
            <div className="command-risk-badge">
              <ExclamationCircleOutlined />
              最大短板
            </div>
            <Button size="small" icon={<CopyOutlined />} onClick={handleCopyCommand}>
              复制指挥
            </Button>
          </div>
        </div>

        <div className="command-factor-grid">
          {strategy.factors.map(factor => (
            <div key={factor.key}>
              <span>{factor.label}</span>
              <strong>{factor.value}</strong>
              <small>{factor.detail}</small>
            </div>
          ))}
        </div>

        {draftRecovery.items.length > 0 && (
          <div className="command-draft-recovery" aria-label="备考指挥未提交回答">
            <div className="command-draft-recovery-head">
              <div>
                <h3>先恢复未提交回答</h3>
                <p>
                  <strong>{draftRecovery.items.length} 份草稿待评分</strong>
                  <span>已经开始的回答优先补完，才能形成连续评分样本。</span>
                </p>
              </div>
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(draftRecovery.primaryPath)}
              >
                恢复 {draftRecovery.items.length} 份草稿
                <ArrowRightOutlined />
              </Button>
            </div>
            <div className="command-draft-recovery-list">
              {draftRecovery.items.map(item => (
                <button key={item.id} type="button" onClick={() => navigate(item.to)}>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="command-next-training" aria-label="下一轮训练">
          <div className="command-next-training-head">
            <div>
              <h3>下一轮训练</h3>
              <p>{nextTrainingQueue.summary}</p>
            </div>
            <Button
              size="small"
              type="primary"
              icon={<FieldTimeOutlined />}
              onClick={() => navigate(nextTrainingQueue.primaryAction.to)}
            >
              {nextTrainingQueue.primaryAction.label}
              <ArrowRightOutlined />
            </Button>
          </div>

          {nextTrainingQueue.items.length > 0 ? (
            <div className="command-next-training-list">
              {nextTrainingQueue.items.map(item => (
                <button key={item.id} type="button" onClick={() => navigate(item.to)}>
                  <strong>{item.title}</strong>
                  <span>{formatNextTrainingQueueItemMeta(item)}</span>
                  <small>{item.actionLabel}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="command-next-training-empty">
              暂无下一轮训练题。先完成一次模拟面试或生成今日计划，系统会自动拼出下一轮队列。
            </p>
          )}
        </div>

        <div className="command-action-row">
          {strategy.actions.map(action => (
            <Button
              key={action.key}
              type={buttonType(action)}
              danger={action.tone === 'warning'}
              icon={<FieldTimeOutlined />}
              onClick={() => navigate(action.to)}
            >
              {action.label}
              <ArrowRightOutlined />
            </Button>
          ))}
        </div>
      </div>
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
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-备考指挥中心.md`
}
