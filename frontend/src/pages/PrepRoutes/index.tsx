import { Button, Progress } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../../utils/feedbackMessage'
import { ArrowRightOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../../data/freeSuperiority'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { buildRoutePlaybookMarkdown, buildRouteProgressList } from '../../utils/routeProgress'

export default function PrepRoutes() {
  const navigate = useNavigate()
  const { addDailyPlanQuestions, progress } = useStudyProgress()
  const routeProgressList = buildRouteProgressList(prepRoutes, progress)

  const handleCopyRoutePlaybook = async () => {
    const markdown = buildRoutePlaybookMarkdown(prepRoutes, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('备考路线战术包已复制')
      return
    }

    downloadMarkdown(markdown, buildRoutePlaybookFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 路线包')
  }

  return (
    <div className="prep-page">
      <section className="prep-hero">
        <div>
          <div className="dashboard-kicker">免费刷题路线</div>
          <h1>按岗位推进，不再盲刷题库</h1>
          <p>
            每条路线都把题库、学习计划和模拟面试串起来。题目、答案、追问和评分全部免费开放。
          </p>
          <div className="prep-hero-actions">
            <Button icon={<CopyOutlined />} onClick={handleCopyRoutePlaybook}>
              复制路线包
            </Button>
          </div>
        </div>
        <div className="prep-hero-stat">
          <strong>{prepRoutes.length}</strong>
          <span>条核心路线</span>
        </div>
      </section>

      <section className="prep-route-grid" aria-label="备考路线">
        {routeProgressList.map(routeProgress => {
          const route = routeProgress.route
          const canPlanRoute = routeProgress.nextQuestionIds.length > 0

          return (
            <article key={route.id} className="prep-route-card">
            <div className="prep-route-card-head">
              <div>
                <span>{route.role}</span>
                <h2>{route.title}</h2>
              </div>
              <em>{route.duration}</em>
            </div>
            <p>{route.summary}</p>

            <div className="prep-route-progress">
              <div>
                <strong>路线完成度</strong>
                <span>{routeProgress.completionRate}%</span>
              </div>
              <Progress percent={routeProgress.completionRate} showInfo={false} strokeColor="#059669" />
            </div>

            <div className="prep-route-metrics" aria-label={`${route.title} 学习进度`}>
              <div>
                <span>记忆题</span>
                <strong>{routeProgress.totalRemembered}</strong>
              </div>
              <div>
                <span>已跟踪</span>
                <strong>{routeProgress.tracked}</strong>
              </div>
              <div>
                <span>计划内</span>
                <strong>{routeProgress.planned}</strong>
              </div>
              <div className={routeProgress.weak > 0 ? 'weak' : ''}>
                <span>薄弱题</span>
                <strong>{routeProgress.weak}</strong>
              </div>
            </div>

            {routeProgress.totalRemembered === 0 && (
              <div className="prep-route-card-alert">
                这条路线还没有本地题目轨迹，先搜索并打开几道题后会自动生成个人进度。
              </div>
            )}

            <div className="prep-route-section">
              <strong>推进阶段</strong>
              <div className="prep-stage-list">
                {route.stages.map(stage => (
                  <span key={stage}>
                    <CheckCircleOutlined />
                    {stage}
                  </span>
                ))}
              </div>
            </div>

            <div className="prep-route-section">
              <strong>覆盖方向</strong>
              <div className="prep-chip-list">
                {route.categories.map(category => <span key={category}>{category}</span>)}
              </div>
            </div>

            <div className="prep-action-row">
              {canPlanRoute && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => addDailyPlanQuestions(routeProgress.nextQuestionIds.slice(0, 8))}
                  >
                    加入今日计划
                  </Button>
                  <Button
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(`/practice?queue=${routeProgress.nextQuestionIds.slice(0, 12).join(',')}&from=ability-gap`)}
                  >
                    路线训练
                  </Button>
                </>
              )}
              {route.actions.map(action => (
                <Button
                  key={action.to}
                  type={!canPlanRoute && action.to === '/practice' ? 'primary' : 'default'}
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(action.to)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            </article>
          )
        })}
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

function buildRoutePlaybookFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '岗位'}-备考路线战术包.md`
}
