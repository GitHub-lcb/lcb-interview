import { ArrowRightOutlined, FieldTimeOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question, StudyProgress } from '../types'
import { buildDailyPlanBrief } from '../utils/dailyPlanBrief'

interface DailyPlanBriefPanelProps {
  progress: StudyProgress
  candidates: Question[]
  now?: string
}

export default function DailyPlanBriefPanel({
  progress,
  candidates,
  now,
}: DailyPlanBriefPanelProps) {
  const navigate = useNavigate()
  const brief = useMemo(
    () => buildDailyPlanBrief(progress, candidates, now),
    [candidates, now, progress],
  )
  const visibleItems = brief.items.slice(0, 6)

  return (
    <section className="daily-plan-brief-panel" aria-label="今日作战简报">
      <div className="daily-plan-brief-head">
        <div>
          <div className="dashboard-kicker">
            <FieldTimeOutlined />
            今日作战简报
          </div>
          <h2>{brief.title}</h2>
          <p>{brief.summary}</p>
        </div>
        <span>{brief.totalCount > 0 ? `展示 ${visibleItems.length}/${brief.totalCount}` : '待生成'}</span>
      </div>

      <div className="daily-plan-brief-metrics">
        {brief.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <div className="daily-plan-brief-empty">
          <ThunderboltOutlined />
          <p>生成今日计划后，这里会解释每道题的训练原因。</p>
        </div>
      ) : (
        <div className="daily-plan-brief-list">
          {visibleItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`source-${item.source}`}
              onClick={() => navigate(item.to)}
            >
              <div>
                <span>{item.sourceLabel}</span>
                <strong>{item.title}</strong>
                <small>{item.categoryName} · {item.reason}</small>
              </div>
              <em>{item.actionLabel}</em>
              <ArrowRightOutlined />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
