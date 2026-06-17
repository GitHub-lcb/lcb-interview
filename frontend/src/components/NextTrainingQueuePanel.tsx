import { ArrowRightOutlined, CopyOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudyProgress } from '../types'
import {
  buildNextTrainingQueue,
  buildNextTrainingQueueMarkdown,
  formatNextTrainingQueueItemMeta,
} from '../utils/nextTrainingQueue'

interface NextTrainingQueuePanelProps {
  progress: StudyProgress
  now?: string
}

export default function NextTrainingQueuePanel({
  progress,
  now,
}: NextTrainingQueuePanelProps) {
  const navigate = useNavigate()
  const queue = useMemo(
    () => buildNextTrainingQueue(progress, now),
    [now, progress],
  )

  const handleCopyQueue = async () => {
    const markdown = buildNextTrainingQueueMarkdown(progress, now)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('下一轮训练队列已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 队列')
  }

  return (
    <section className="next-training-queue-panel" aria-label="下一轮训练队列">
      <div className="next-training-queue-head">
        <div>
          <div className="dashboard-kicker">
            <ThunderboltOutlined />
            下一轮训练队列
          </div>
          <h2>{queue.title}</h2>
          <p>{queue.summary}</p>
        </div>
        <div className="next-training-queue-total">
          <strong>{queue.totalCount}</strong>
          <span>道题</span>
        </div>
      </div>

      <div className="next-training-queue-body">
        <div className="next-training-queue-metrics">
          {queue.metrics.map(metric => (
            <article key={metric.key}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="next-training-queue-action">
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyQueue}>
            复制训练队列
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(queue.primaryAction.to)}>
            {queue.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
          <span>{queue.primaryAction.description}</span>
        </div>
      </div>

      {queue.items.length === 0 ? (
        <div className="next-training-queue-empty">
          <strong>暂无训练题单</strong>
          <span>先完成一次模拟面试或生成今日计划，系统会自动拼出下一轮队列。</span>
        </div>
      ) : (
        <div className="next-training-queue-list">
          {queue.items.map(item => (
            <button key={item.id} type="button" className={`source-${item.source}`} onClick={() => navigate(item.to)}>
              <div>
                <div className="next-training-queue-item-top">
                  <strong>{item.title}</strong>
                  <em>{item.actionLabel}</em>
                </div>
                <span>{formatNextTrainingQueueItemMeta(item)}</span>
                <small>{item.reason}</small>
              </div>
              <ArrowRightOutlined />
            </button>
          ))}
        </div>
      )}
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
  return `${safeRole || '岗位'}-下一轮训练队列.md`
}
