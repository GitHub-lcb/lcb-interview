import { Button, Progress } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import { ArrowRightOutlined, CopyOutlined, RadarChartOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../data/freeSuperiority'
import { useStudyProgress } from '../hooks/useStudyProgress'
import type { AbilityMapItem, AbilityReadinessLevel } from '../types'
import { buildAbilityMap, buildAbilityMapMarkdown } from '../utils/abilityMap'

const levelLabels: Record<AbilityReadinessLevel, string> = {
  empty: '待建立',
  weak: '短板明显',
  building: '建设中',
  ready: '可冲刺',
}

function abilityTone(item: AbilityMapItem) {
  if (item.readinessLevel === 'ready') {
    return 'ready'
  }
  if (item.readinessLevel === 'weak') {
    return 'weak'
  }
  if (item.readinessLevel === 'empty') {
    return 'empty'
  }
  return 'building'
}

export default function AbilityMapPanel() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const abilityItems = useMemo(() => buildAbilityMap(prepRoutes, progress), [progress])

  const handleCopyAbilityMap = async () => {
    const markdown = buildAbilityMapMarkdown(prepRoutes, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('岗位能力地图已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 能力地图')
  }

  const startAbilityPractice = (item: AbilityMapItem) => {
    if (item.nextQuestionIds.length === 0) {
      navigate('/routes')
      return
    }
    navigate(`/practice?queue=${item.nextQuestionIds.join(',')}`)
  }

  return (
    <section className="ability-map-panel" aria-label="岗位能力地图">
      <div className="ability-map-heading">
        <div>
          <div className="dashboard-kicker">岗位能力地图</div>
          <h2>按目标岗位看准备度</h2>
          <p>系统只用你已经浏览和训练过的本地记录生成画像，不拉全量题库，也不需要登录。</p>
        </div>
        <div className="ability-map-heading-actions">
          <RadarChartOutlined />
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyAbilityMap}>
            复制地图
          </Button>
        </div>
      </div>

      <div className="ability-map-grid">
        {abilityItems.map(item => {
          const tone = abilityTone(item)
          return (
            <article key={item.routeId} className={`ability-map-card tone-${tone}`}>
              <div className="ability-map-card-head">
                <div>
                  <span>{item.role}</span>
                  <h3>{item.title}</h3>
                </div>
                <em>{levelLabels[item.readinessLevel]}</em>
              </div>

              <div className="ability-map-score">
                <strong>{item.readinessScore}</strong>
                <Progress percent={item.readinessScore} showInfo={false} strokeColor={item.readinessScore >= 75 ? '#059669' : '#2563EB'} />
              </div>

              <div className="ability-map-metrics">
                <div>
                  <span>覆盖</span>
                  <strong>{item.remembered}</strong>
                </div>
                <div>
                  <span>薄弱</span>
                  <strong>{item.weak}</strong>
                </div>
                <div>
                  <span>学习中</span>
                  <strong>{item.learning}</strong>
                </div>
                <div>
                  <span>掌握</span>
                  <strong>{item.mastered}</strong>
                </div>
              </div>

              <p>{item.summary}</p>

              <Button
                type={item.nextQuestionIds.length > 0 ? 'primary' : 'default'}
                icon={<ArrowRightOutlined />}
                onClick={() => startAbilityPractice(item)}
              >
                {item.nextQuestionIds.length > 0 ? '训练短板能力' : '打开备考路线'}
              </Button>
            </article>
          )
        })}
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
  return `${safeRole || '岗位'}-岗位能力地图.md`
}
