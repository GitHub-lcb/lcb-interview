import { BookOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'

interface Props {
  /** 分类（学习模块）总数，加载完成前为 0 */
  categoryCount: number
  /** 题目总数，来自分页接口的 total；加载失败时为 null */
  totalQuestions: number | null
}

/**
 * 首页 Hero：用大统计数字说明产品主线，
 * 主行动固定进入训练台，次行动进入题库，避免首页出现多个互相竞争的主按钮。
 */
export default function LabHero({ categoryCount, totalQuestions }: Props) {
  const navigate = useNavigate()

  return (
    <section className="lab-hero" aria-label="站点概览">
      <p className="lab-hero-eyebrow">INTERVIEW TRAINING SYSTEM</p>
      <h1 className="lab-hero-title">把面试准备，收敛成每天一次训练</h1>
      <p className="lab-hero-sub">
        从 {categoryCount > 0 ? categoryCount : '…'} 个技术方向、
        {totalQuestions != null ? totalQuestions.toLocaleString() : '…'} 道面试题里选出今天该练的；
        开口作答、拿到评分、进入下一轮。
      </p>

      <div className="lab-hero-actions">
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          onClick={() => navigate('/training')}
        >
          进入训练台
        </Button>
        <Button
          size="large"
          icon={<BookOutlined />}
          onClick={() => navigate('/banks')}
        >
          浏览题库
        </Button>
      </div>

      <div className="lab-hero-stats">
        <div className="lab-stat">
          <span className="lab-stat-value">{categoryCount > 0 ? categoryCount : '…'}</span>
          <span className="lab-stat-label">技术方向</span>
        </div>
        <div className="lab-stat">
          <span className="lab-stat-value">
            {totalQuestions != null ? totalQuestions.toLocaleString() : '…'}
          </span>
          <span className="lab-stat-label">道面试题</span>
        </div>
        <div className="lab-stat lab-stat-loop">
          <span className="lab-stat-value">4 步</span>
          <span className="lab-stat-label">选题 · 开口 · 评分 · 复盘</span>
        </div>
      </div>

      <p className="lab-hero-free">免费使用 · 无需登录 · 无需会员</p>
    </section>
  )
}
