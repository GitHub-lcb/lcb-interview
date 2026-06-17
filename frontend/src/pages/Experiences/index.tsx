import { Button } from 'antd'
import { ArrowRightOutlined, BulbOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { experienceSets } from '../../data/freeSuperiority'

export default function Experiences() {
  const navigate = useNavigate()

  return (
    <div className="experience-page">
      <section className="prep-hero experience-hero">
        <div>
          <div className="dashboard-kicker">真实面试场景</div>
          <h1>把题目放回面试官会追问的场景</h1>
          <p>
            按公司类型、岗位深挖和终面表达组织训练。所有题单和模拟练习都免费进入，不做内容锁。
          </p>
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
