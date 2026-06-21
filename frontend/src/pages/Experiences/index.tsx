import { Button } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../../utils/feedbackMessage'
import { ArrowRightOutlined, BulbOutlined, CopyOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { experienceSets } from '../../data/freeSuperiority'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { buildExperiencePlaybookMarkdown, buildExperiencePressureQueue } from '../../utils/experiencePlaybook'

export default function Experiences() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const pressureQueue = useMemo(() => buildExperiencePressureQueue(progress), [progress])

  const handleCopyExperiencePlaybook = async () => {
    const markdown = buildExperiencePlaybookMarkdown(experienceSets, progress.targetRole, new Date().toISOString(), progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('真实面试场景包已复制')
      return
    }

    downloadMarkdown(markdown, buildExperiencePlaybookFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 场景包')
  }

  return (
    <div className="experience-page">
      <section className="prep-hero experience-hero">
        <div>
          <div className="dashboard-kicker">真实面试场景</div>
          <h1>把题目放回面试官会追问的场景</h1>
          <p>
            按公司类型、岗位深挖和终面表达组织训练。所有题单和模拟练习都免费进入，不做内容锁。
          </p>
          <div className="prep-hero-actions">
            <Button icon={<CopyOutlined />} onClick={handleCopyExperiencePlaybook}>
              复制场景包
            </Button>
          </div>
        </div>
        <div className="prep-hero-stat">
          <strong>{experienceSets.length}</strong>
          <span>组场景题单</span>
        </div>
      </section>

      <section className="experience-pressure-panel" aria-label="个人押题队列">
        <div className="experience-pressure-head">
          <div>
            <div className="dashboard-kicker">个人押题队列</div>
            <h2>{pressureQueue.title}</h2>
            <p>{pressureQueue.summary}</p>
          </div>
          <div className="experience-pressure-stat">
            <strong>{pressureQueue.totalCount}</strong>
            <span>道高压题</span>
          </div>
        </div>

        {pressureQueue.items.length > 0 ? (
          <div className="experience-pressure-list">
            {pressureQueue.items.map(item => (
              <button key={item.questionId} type="button" onClick={() => navigate(item.practicePath)}>
                <span>{item.signal}</span>
                <strong>{item.title}</strong>
                <em>{item.categoryName} · {item.difficulty}</em>
                <p>{item.detail}</p>
                <div className="experience-pressure-proof">
                  <small>面试官追问</small>
                  <p>{item.interviewerProbe}</p>
                  <small>通过口径</small>
                  <p>{item.passCriteria}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="experience-pressure-empty">
            完成一轮模拟面试或把题目标记为薄弱后，这里会自动出现面试官最可能追问的个人题单。
          </p>
        )}

        <div className="prep-action-row">
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(pressureQueue.queuePath)}>
            开始押题练习
          </Button>
        </div>
      </section>

      <section className="experience-grid" aria-label="面试场景题单">
        {experienceSets.map(set => (
          <article key={set.id} className="experience-card">
            <div className="experience-card-head">
              <div>
                <span>{set.companyType}</span>
                <h2>{set.title}</h2>
              </div>
              <BulbOutlined />
            </div>
            <p>{set.summary}</p>

            <div className="experience-drill-list">
              {set.drills.map(drill => <span key={drill}>{drill}</span>)}
            </div>

            <div className="prep-action-row">
              {set.actions.map(action => (
                <Button
                  key={action.to}
                  type={action.to === '/practice' ? 'primary' : 'default'}
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(action.to)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
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

function buildExperiencePlaybookFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-真实面试场景包.md`
}
