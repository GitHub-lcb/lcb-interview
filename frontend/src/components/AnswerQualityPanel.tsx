import { Button, message, Progress } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import type { Question } from '../types'
import {
  buildAnswerQualityMarkdown,
  calculateAnswerQuality,
  generateFollowUps,
  getMistakeHint,
} from '../utils/answerQuality'

interface Props {
  question: Question
}

export default function AnswerQualityPanel({ question }: Props) {
  const quality = calculateAnswerQuality(question)
  const followUps = generateFollowUps(question)

  const handleCopyQuality = async () => {
    const markdown = buildAnswerQualityMarkdown(question)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('答案质量卡已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    message.warning('剪贴板不可用，已下载 Markdown 质量卡')
  }

  return (
    <aside className="answer-quality-panel">
      <section className="quality-score-card">
        <div className="quality-score-card-head">
          <div className="panel-kicker">答案质量</div>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyQuality}>
            复制质量
          </Button>
        </div>
        <div className="quality-score">{quality.score}</div>
        <Progress percent={quality.score} showInfo={false} strokeColor={quality.score >= 85 ? '#059669' : '#2563EB'} />
        <div className="panel-muted">
          {quality.level === 'excellent' ? '结构完整，可直接复述' : quality.level === 'good' ? '可用，建议补齐弱项' : '缺少关键面试模块'}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-title">面试官追问</div>
        <ol className="panel-list">
          {followUps.map(item => <li key={item}>{item}</li>)}
        </ol>
      </section>

      {quality.completedFields.length > 0 && (
        <section className="panel-card">
          <div className="panel-title">已覆盖模块</div>
          <div className="covered-field-list">
            {quality.completedFields.slice(0, 6).map(field => <span key={field}>{field}</span>)}
          </div>
        </section>
      )}

      <section className="panel-card warning">
        <div className="panel-title">不要这么答</div>
        <p>{getMistakeHint(question)}</p>
      </section>

      {quality.missingFields.length > 0 && (
        <section className="panel-card">
          <div className="panel-title">可补强模块</div>
          <div className="missing-field-list">
            {quality.missingFields.slice(0, 4).map(field => <span key={field}>{field}</span>)}
          </div>
        </section>
      )}
    </aside>
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

function buildFileName(title: string): string {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeTitle || '题目'}-答案质量卡.md`
}
