import { Button, Empty, InputNumber, Progress, Select } from 'antd'
import { ArrowRightOutlined, BookOutlined, FireOutlined, PlayCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { buildReviewQueue, resolvePlanQuestions, summarizeProgress } from '../../utils/studyProgress'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
const roleOptions = [
  { label: 'Java 后端', value: 'Java 后端' },
  { label: '全栈工程师', value: '全栈工程师' },
  { label: 'AI 大模型', value: 'AI 大模型' },
  { label: '前端工程师', value: '前端工程师' },
  { label: '系统架构师', value: '系统架构师' },
]

export default function StudyPlan() {
  const navigate = useNavigate()
  const { getState, progress, setInPlan, setStatus, updateSettings } = useStudyProgress()
  const summary = summarizeProgress(progress)
  const planQuestions = resolvePlanQuestions(progress, [], 8)
  const reviewQueue = buildReviewQueue(progress, 12)
  const trackedCount = Object.keys(progress.questionStates).length

  return (
    <div>
      <div className="study-plan-header">
        <div>
          <div className="dashboard-kicker">学习计划</div>
          <h1>{progress.targetRole} · 今日复习</h1>
          <p>从薄弱题开始复盘，再推进今日计划。这里的数据保存在本机。</p>
        </div>
        <div className="study-plan-header-actions">
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/practice')}>
            开始训练
          </Button>
          <Button icon={<BookOutlined />} onClick={() => navigate('/banks')}>
            继续刷题
          </Button>
        </div>
      </div>

      <section className="study-settings-panel">
        <div className="study-settings-title">
          <SettingOutlined />
          <div>
            <strong>备考目标</strong>
            <small>目标会影响工作台和训练页的节奏展示</small>
          </div>
        </div>
        <div className="study-settings-controls">
          <label>
            <span>方向</span>
            <Select
              value={progress.targetRole}
              options={roleOptions}
              onChange={(value) => updateSettings({ targetRole: value })}
            />
          </label>
          <label>
            <span>周期</span>
            <div className="study-sprint-input">
              <InputNumber
                min={7}
                max={60}
                value={progress.sprintDays}
                onChange={(value) => updateSettings({ sprintDays: value })}
              />
              <em>天</em>
            </div>
          </label>
        </div>
      </section>

      <div className="study-plan-metrics">
        <div>
          <span>掌握度</span>
          <strong>{summary.masteryRate}%</strong>
          <Progress percent={summary.masteryRate} showInfo={false} strokeColor="#059669" />
        </div>
        <div>
          <span>薄弱题</span>
          <strong>{summary.weak}</strong>
          <small>优先复盘</small>
        </div>
        <div>
          <span>学习中</span>
          <strong>{summary.learning}</strong>
          <small>继续巩固</small>
        </div>
        <div>
          <span>已跟踪</span>
          <strong>{trackedCount}</strong>
          <small>本机记录</small>
        </div>
      </div>

      <div className="study-plan-grid">
        <section className="study-plan-section">
          <div className="study-plan-section-title">
            <span>今日计划</span>
            <small>{planQuestions.length} 道</small>
          </div>
          {planQuestions.length === 0 ? (
            <Empty description="还没有加入今日计划的题目">
              <Button type="primary" ghost onClick={() => navigate('/')}>从热门题开始</Button>
            </Empty>
          ) : (
            <div className="study-question-stack">
              {planQuestions.map(question => {
                const state = getState(question.id)
                return (
                  <article key={question.id} className="study-question-item" onClick={() => navigate(`/question/${question.id}`)}>
                    <div>
                      <h3>{question.title}</h3>
                      <div className="study-question-meta">
                        <span>{question.categoryName}</span>
                        <span className={`difficulty-tag ${question.difficulty.toLowerCase()}`}>
                          {difficultyLabels[question.difficulty] || question.difficulty}
                        </span>
                        <StudyStatusBadge status={state.status} addedToPlan={state.addedToPlan} />
                      </div>
                    </div>
                    <StudyActionButtons
                      compact
                      questionId={question.id}
                      state={state}
                      onPlanChange={setInPlan}
                      onMarkWeak={(id) => setStatus(id, 'weak')}
                      onMarkMastered={(id) => setStatus(id, 'mastered')}
                    />
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="study-plan-section">
          <div className="study-plan-section-title">
            <span>复习队列</span>
            <small>{reviewQueue.length} 道</small>
          </div>
          {reviewQueue.length === 0 ? (
            <div className="study-empty-panel">
              <FireOutlined />
              <p>标记薄弱或加入计划后，这里会自动生成复习队列。</p>
            </div>
          ) : (
            <div className="review-queue-list">
              {reviewQueue.map(item => {
                const state = getState(item.id)
                return (
                  <button key={item.id} onClick={() => navigate(`/question/${item.id}`)}>
                    <div>
                      <span>{item.reason}</span>
                      <strong>{item.title}</strong>
                      <small>{item.categoryName} · 复习 {item.reviewCount} 次</small>
                    </div>
                    <ArrowRightOutlined />
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
