import { Button } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  FireOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../data/freeSuperiority'
import type { InterviewBriefItem, StudyProgress } from '../types'
import { buildInterviewBrief } from '../utils/interviewBrief'

interface InterviewBriefPanelProps {
  progress: StudyProgress
}

function renderBriefItems(
  items: InterviewBriefItem[],
  emptyText: string,
  onNavigate: (to: string) => void,
) {
  if (items.length === 0) {
    return <p className="interview-brief-empty">{emptyText}</p>
  }

  return (
    <div className="interview-brief-list">
      {items.map(item => (
        <button key={item.id} type="button" onClick={() => item.to && onNavigate(item.to)}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </div>
          <em>{item.metric}</em>
        </button>
      ))}
    </div>
  )
}

export default function InterviewBriefPanel({ progress }: InterviewBriefPanelProps) {
  const navigate = useNavigate()
  const brief = useMemo(() => buildInterviewBrief(prepRoutes, progress), [progress])

  return (
    <section className={`interview-brief-panel level-${brief.level}`} aria-label="面试前冲刺简报">
      <div className="interview-brief-head">
        <div>
          <div className="dashboard-kicker">面试前冲刺简报</div>
          <h2>{brief.title}</h2>
          <p>{brief.summary}</p>
        </div>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(brief.primaryAction.to)}>
          {brief.primaryAction.label}
          <ArrowRightOutlined />
        </Button>
      </div>

      <div className="interview-brief-action-note">
        <ThunderboltOutlined />
        <span>{brief.primaryAction.description}</span>
      </div>

      <div className="interview-brief-grid">
        <article className="interview-brief-card strength">
          <div className="interview-brief-card-title">
            <BookOutlined />
            <span>可主动表达</span>
          </div>
          {renderBriefItems(brief.strengths, '掌握题会自动沉淀为面试优势。', navigate)}
        </article>

        <article className="interview-brief-card risk">
          <div className="interview-brief-card-title">
            <FireOutlined />
            <span>必须规避</span>
          </div>
          {renderBriefItems(brief.risks, '当前没有显著风险，保持节奏即可。', navigate)}
        </article>

        <article className="interview-brief-card warmup">
          <div className="interview-brief-card-title">
            <PlayCircleOutlined />
            <span>开口热身</span>
          </div>
          {renderBriefItems(brief.warmups, '加入计划或复习队列后会生成热身题。', navigate)}
        </article>
      </div>
    </section>
  )
}
