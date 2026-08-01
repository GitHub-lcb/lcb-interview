interface Props {
  /** 分类（学习模块）总数，加载完成前为 0 */
  categoryCount: number
  /** 题目总数，来自分页接口的 total；加载失败时为 null */
  totalQuestions: number | null
}

/**
 * 首页 Hero：对标参考站「大统计数字」区，
 * 用等宽字体呈现模块数、题目数和免费体验三个核心指标。
 */
export default function LabHero({ categoryCount, totalQuestions }: Props) {
  return (
    <section className="lab-hero" aria-label="站点概览">
      <p className="lab-hero-eyebrow">MODULAR INTERVIEW LAB</p>
      <h1 className="lab-hero-title">模块化 Java 面试训练实验室</h1>
      <p className="lab-hero-sub">
        按技术方向拆解的面试题库与训练系统，选中模块即可开始刷题。
      </p>

      <div className="lab-hero-stats">
        <div className="lab-stat">
          <span className="lab-stat-value">{categoryCount > 0 ? categoryCount : '…'}</span>
          <span className="lab-stat-label">学习模块</span>
        </div>
        <div className="lab-stat">
          <span className="lab-stat-value">
            {totalQuestions != null ? totalQuestions.toLocaleString() : '…'}
          </span>
          <span className="lab-stat-label">道面试题</span>
        </div>
        <div className="lab-stat lab-stat-free">
          <span className="lab-stat-value">免费体验</span>
          <span className="lab-stat-label">无需登录 · 无需会员</span>
        </div>
      </div>
    </section>
  )
}
