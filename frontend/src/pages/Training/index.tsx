import { useMemo } from 'react'
import { Button, Tag } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FireOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  SolutionOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import NextTrainingQueuePanel from '../../components/NextTrainingQueuePanel'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { buildContinuePracticePath } from '../../utils/practiceRoute'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from '../../utils/reviewSchedule'
import { getQuestionState, summarizeProgress } from '../../utils/studyProgress'

const trainingModes = [
  {
    key: 'practice',
    icon: <PlayCircleOutlined />,
    title: '模拟面试',
    tag: '核心训练',
    description: '单题计时作答，提交后拿到评分、追问和下一题建议。',
    meta: '评分 · 追问 · 下一题建议',
    action: '进入模拟面试',
    to: '/practice',
    primary: true,
  },
  {
    key: 'recall',
    icon: <ThunderboltOutlined />,
    title: '主动回忆',
    tag: '记忆巩固',
    description: '先复述再自评，按间隔重复把高频题压进长期记忆。',
    meta: '间隔重复 · 自评 · 到期复习',
    action: '开始主动回忆',
    to: '/recall',
    primary: false,
  },
  {
    key: 'experience',
    icon: <SolutionOutlined />,
    title: '面经场景',
    tag: '临场表达',
    description: '把题目放回真实面试官会追问的场景，练临场表达。',
    meta: '真实追问 · 压力押题 · 项目证据',
    action: '进入面经场景',
    to: '/experiences',
    primary: false,
  },
]

const trainingLoop = [
  { step: '01', title: '选题', detail: '按岗位、薄弱点和到期复习组队' },
  { step: '02', title: '开口', detail: '计时作答，用面试口径复述答案' },
  { step: '03', title: '评分', detail: '拿到分数、追问和下一题建议' },
  { step: '04', title: '复盘', detail: '薄弱题自动进入下一轮训练队列' },
]

export default function Training() {
  const navigate = useNavigate()
  const { progress } = useStudyProgress()
  const summary = useMemo(() => summarizeProgress(progress), [progress])
  const reviewSummary = useMemo(
    () => summarizeReviewSchedule(buildScheduledReviewQueue(progress, new Date().toISOString(), 100)),
    [progress],
  )
  const pendingPlanCount = useMemo(
    () => progress.dailyPlan.filter(questionId => getQuestionState(progress, questionId).status !== 'mastered').length,
    [progress],
  )
  const primaryPath = pendingPlanCount > 0
    ? buildContinuePracticePath(progress)
    : progress.dailyPlan.length > 0 ? '/practice' : '/banks'
  const primaryLabel = pendingPlanCount > 0
    ? `开始今日训练（${pendingPlanCount} 题）`
    : progress.dailyPlan.length > 0 ? '今日计划已完成，再练一组' : '从题库选一组题'
  const dueReviewCount = reviewSummary.overdue + reviewSummary.dueToday

  return (
    <div className="training-page">
      <header className="training-hero">
        <div className="training-hero-copy">
          <div className="dashboard-kicker">训练台</div>
          <h1>把答案说出口，才算真的会</h1>
          <p>
            题库只是起点。这里把「选题 → 开口作答 → 拿到评分 → 进入下一轮」串成一条每天可执行的训练路径。
          </p>
          <div className="training-hero-actions">
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={() => navigate(primaryPath)}
            >
              {primaryLabel}
            </Button>
            <Button size="large" icon={<CalendarOutlined />} onClick={() => navigate('/study?view=today')}>
              查看学习计划
            </Button>
          </div>
        </div>

        <div className="training-hero-stats" aria-label="训练状态">
          <div>
            <span>今日队列</span>
            <strong>{progress.dailyPlan.length}</strong>
            <small>道待练</small>
          </div>
          <div>
            <span>到期复习</span>
            <strong>{dueReviewCount}</strong>
            <small>道需回收</small>
          </div>
          <div>
            <span>待补弱</span>
            <strong>{summary.weak}</strong>
            <small>道已标记</small>
          </div>
        </div>
      </header>

      <ol className="training-loop-flow" aria-label="训练闭环">
        {trainingLoop.map(item => (
          <li key={item.step}>
            <span>{item.step}</span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          </li>
        ))}
      </ol>

      <section className="training-modes" aria-label="训练模式">
        <div className="training-section-head">
          <div>
            <h2>选择训练方式</h2>
            <p>三种模式共用同一份学习进度，练完都会进入复盘和下一轮队列。</p>
          </div>
          <Tag icon={<CheckCircleOutlined />} color="success">进度互通</Tag>
        </div>

        <div className="training-mode-grid">
          {trainingModes.map(mode => (
            <article key={mode.key} className={`training-mode-card mode-${mode.key}`}>
              <div className="training-mode-top">
                <span className="training-mode-icon">{mode.icon}</span>
                <Tag bordered={false}>{mode.tag}</Tag>
              </div>
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
              <small>{mode.meta}</small>
              <Button
                type={mode.primary ? 'primary' : 'default'}
                icon={<ArrowRightOutlined />}
                onClick={() => navigate(mode.to)}
              >
                {mode.action}
              </Button>
            </article>
          ))}
        </div>
      </section>

      <NextTrainingQueuePanel progress={progress} />

      <section className="training-resource-band" aria-label="备考资源">
        <div>
          <strong>不知道练什么？</strong>
          <span>从岗位路线或高频考点开始，把题加入今日队列。</span>
        </div>
        <div className="training-resource-links">
          <Link to="/routes"><ReadOutlined /> 备考路线</Link>
          <Link to="/knowledge"><FireOutlined /> 高频考点</Link>
          <Link to="/banks"><BookOutlined /> 浏览题库</Link>
        </div>
      </section>
    </div>
  )
}
