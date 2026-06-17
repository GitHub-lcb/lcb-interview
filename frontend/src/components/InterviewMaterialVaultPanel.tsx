import { ArrowRightOutlined, HighlightOutlined, StarOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useMemo } from 'react'
import type { InterviewMaterialSnippet, InterviewMaterialVault, StudyProgress } from '../types'
import { buildInterviewMaterialVault } from '../utils/interviewMaterialVault'

interface InterviewMaterialVaultPanelProps {
  progress: StudyProgress
  onNavigate: (to: string) => void
}

const levelLabels: Record<InterviewMaterialVault['level'], string> = {
  empty: '待沉淀',
  building: '扩充中',
  ready: '可复用',
}

const kindClassNames: Record<InterviewMaterialSnippet['kind'], string> = {
  conclusion: 'kind-conclusion',
  scenario: 'kind-scenario',
  risk: 'kind-risk',
}

export default function InterviewMaterialVaultPanel({
  progress,
  onNavigate,
}: InterviewMaterialVaultPanelProps) {
  const vault = useMemo(() => buildInterviewMaterialVault(progress), [progress])

  return (
    <section className={`interview-material-vault-panel level-${vault.level}`} aria-label="高分表达素材库">
      <div className="interview-material-vault-head">
        <div>
          <div className="dashboard-kicker">
            <StarOutlined />
            高分表达素材库
          </div>
          <h2>{vault.title}</h2>
          <p>{vault.summary}</p>
        </div>
        <div className="interview-material-vault-action">
          <span>{levelLabels[vault.level]}</span>
          <Button type="primary" icon={<HighlightOutlined />} onClick={() => onNavigate(vault.primaryAction.to)}>
            {vault.primaryAction.label}
            <ArrowRightOutlined />
          </Button>
        </div>
      </div>

      <div className="interview-material-vault-metrics">
        {vault.metrics.map(metric => (
          <article key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      {vault.snippets.length === 0 ? (
        <p className="interview-material-vault-empty">完成 80 分以上模拟回答后，这里会自动沉淀可复述的话术片段。</p>
      ) : (
        <div className="interview-material-vault-list">
          {vault.snippets.map(snippet => (
            <button
              key={snippet.id}
              type="button"
              className={kindClassNames[snippet.kind]}
              onClick={() => onNavigate(snippet.to)}
            >
              <div>
                <div className="interview-material-vault-item-top">
                  <strong>{snippet.title}</strong>
                  <em>{snippet.label} · {snippet.score} 分</em>
                </div>
                <p>{snippet.content}</p>
                <small>{snippet.reason}</small>
              </div>
              <ArrowRightOutlined />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
