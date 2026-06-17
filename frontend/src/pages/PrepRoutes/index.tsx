import { Button } from 'antd'
import { ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { prepRoutes } from '../../data/freeSuperiority'

export default function PrepRoutes() {
  const navigate = useNavigate()

  return (
    <div className="prep-page">
      <section className="prep-hero">
        <div>
          <div className="dashboard-kicker">免费刷题路线</div>
          <h1>按岗位推进，不再盲刷题库</h1>
          <p>
            每条路线都把题库、学习计划和模拟面试串起来。题目、答案、追问和评分全部免费开放。
          </p>
        </div>
        <div className="prep-hero-stat">
          <strong>{prepRoutes.length}</strong>
          <span>条核心路线</span>
        </div>
      </section>

      <section className="prep-route-grid" aria-label="备考路线">
        {prepRoutes.map(route => (
          <article key={route.id} className="prep-route-card">
            <div className="prep-route-card-head">
              <div>
                <span>{route.role}</span>
                <h2>{route.title}</h2>
              </div>
              <em>{route.duration}</em>
            </div>
            <p>{route.summary}</p>

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
              {route.actions.map(action => (
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
