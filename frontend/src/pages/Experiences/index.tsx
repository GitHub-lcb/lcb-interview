import { Button, message } from 'antd'
import { ArrowRightOutlined, BulbOutlined, CopyOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { experienceSets } from '../../data/freeSuperiority'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { buildExperiencePlaybookMarkdown } from '../../utils/experiencePlaybook'

export default function Experiences() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()

  const handleCopyExperiencePlaybook = async () => {
    const markdown = buildExperiencePlaybookMarkdown(experienceSets, progress.targetRole)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      message.success('真实面试场景包已复制')
      return
    }

    downloadMarkdown(markdown, buildExperiencePlaybookFileName(progress.targetRole))
    message.warning('剪贴板不可用，已下载 Markdown 场景包')
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
