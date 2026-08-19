import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Empty, Input, Progress, Segmented, Space, Tag, Tooltip, message } from 'antd'
import {
  CheckOutlined,
  EyeOutlined,
  SoundOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { listQuestionsByIds } from '../../api/question'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { buildScheduledReviewQueue } from '../../utils/reviewSchedule'
import { RECALL_GRADE_OPTIONS, previewIntervalDays, scheduleNextRecall } from '../../utils/spacedRepetition'
import { buildClozeDrill, checkClozeAnswers, type ClozeCheckResult } from '../../utils/clozeDrill'
import type { Question, RecallGrade } from '../../types'

type RecallMode = 'flashcard' | 'listen' | 'cloze'

/** 翻转卡显示答案前的最短停留秒数：强制先回忆，避免秒翻秒忘。 */
const REVEAL_DELAY_SECONDS = 3

const MODE_LABELS: Record<RecallMode, string> = {
  flashcard: '翻转卡',
  listen: '听背',
  cloze: '挖空默写',
}

const STATE_TAGS: Record<string, { label: string; color: string }> = {
  new: { label: '未开始', color: 'default' },
  learning: { label: '学习中', color: 'processing' },
  mastered: { label: '已掌握', color: 'success' },
  weak: { label: '薄弱', color: 'error' },
}

export default function Recall() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { progress, getState, rememberQuestion, applyGrade } = useStudyProgress()
  const [mode, setMode] = useState<RecallMode>('flashcard')
  const [queue, setQueue] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [revealCountdown, setRevealCountdown] = useState(REVEAL_DELAY_SECONDS)
  const [clozeAnswers, setClozeAnswers] = useState<string[]>([])
  const [clozeResult, setClozeResult] = useState<ClozeCheckResult | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const current = queue[index] ?? null

  const clozeDrill = useMemo(() => (current ? buildClozeDrill(current) : null), [current])

  const resetCardState = useCallback(() => {
    setRevealed(false)
    setRevealCountdown(REVEAL_DELAY_SECONDS)
    setClozeAnswers([])
    setClozeResult(null)
  }, [])

  const goToIndex = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(queue.length - 1, next)))
    resetCardState()
  }, [queue.length, resetCardState])

  // 组装背诵队列：URL 指定 ids（从题目列表页「背本页」跳转）优先，否则用复习到期队列 + 今日计划。
  useEffect(() => {
    const idsParam = searchParams.get('ids')
    const explicitIds = idsParam
      ? idsParam.split(',').map(Number).filter(id => Number.isInteger(id) && id > 0)
      : []
    if (explicitIds.length > 0) {
      listQuestionsByIds(explicitIds).then(questions => {
        // 按传入顺序排列，保持用户在列表页看到的顺序。
        const byId = new Map(questions.map(q => [q.id, q]))
        setQueue(explicitIds.map(id => byId.get(id)).filter((q): q is Question => Boolean(q)))
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
      return
    }

    const dueIds = buildScheduledReviewQueue(progress)
      .filter(item => item.dueStatus !== 'upcoming')
      .map(item => item.id)
    const candidateIds = [...new Set([...dueIds, ...progress.dailyPlan])].slice(0, 20)
    if (candidateIds.length === 0) {
      setLoading(false)
      return
    }
    listQuestionsByIds(candidateIds).then(questions => {
      // 候选顺序已经是「到期优先 + 热门优先」，按该顺序还原队列。
      const rank = new Map(candidateIds.map((id, order) => [id, order]))
      setQueue(
        [...questions].sort(
          (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) || b.viewCount - a.viewCount,
        ),
      )
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
    // 只在挂载和 ids 参数变化时重建队列，避免评分写入触发队列重排导致题目跳动。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 遇到题目即记录快照，供离线进度与后续复习队列使用。
  useEffect(() => {
    if (current) {
      rememberQuestion(current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  // 翻面前的倒计时：保证先回忆再翻面，这是翻转卡模式的核心训练约束。
  useEffect(() => {
    if (mode !== 'flashcard' || revealed || revealCountdown <= 0) {
      return
    }
    const timer = window.setTimeout(() => {
      setRevealCountdown(countdown => countdown - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [mode, revealed, revealCountdown])

  // TTS 朗读：Web Speech API，读 summary（30 秒口径是最适合听的粒度）。
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      message.warning('当前浏览器不支持语音朗读')
      return
    }
    const content = text.trim()
    if (!content) {
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [])

  // 切题或切模式时停止朗读；离开页面也要停止，避免后台继续发声。
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [index, mode])

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleGrade = (grade: RecallGrade) => {
    if (!current) {
      return
    }
    applyGrade(current.id, grade)
    if (index < queue.length - 1) {
      goToIndex(index + 1)
    } else {
      message.success('本轮背诵完成，休息一下吧')
      goToIndex(0)
    }
  }

  const handleSubmitCloze = () => {
    if (!clozeDrill || !current) {
      return
    }
    const result = checkClozeAnswers(clozeDrill, clozeAnswers)
    setClozeResult(result)
    // 默写得分即回忆表现：≥80 视为记住（good），40-79 模糊（hard），更低视为忘了（again），
    // 让默写训练直接驱动 SM-2 排期而不需要用户再手动评分。
    if (result.score >= 80) {
      applyGrade(current.id, 'good')
    } else if (result.score >= 40) {
      applyGrade(current.id, 'hard')
    } else {
      applyGrade(current.id, 'again')
    }
  }

  if (loading) {
    return (
      <div className="recall-page">
        <Alert type="info" showIcon message="正在加载背诵队列..." />
      </div>
    )
  }

  if (queue.length === 0 || !current) {
    return (
      <div className="recall-page">
        <Empty description="暂无到期背诵任务。先去题库把题目加入计划或标记状态，回来就会出现在这里。">
          <Button type="primary" onClick={() => navigate('/banks')}>去题库选题</Button>
          <Button onClick={() => navigate('/study')}>查看学习中心</Button>
        </Empty>
      </div>
    )
  }

  const state = getState(current.id)
  const stateTag = STATE_TAGS[state.status] ?? STATE_TAGS.new

  return (
    <div className="recall-page">
      <div className="recall-toolbar">
        <Segmented
          value={mode}
          onChange={value => setMode(value as RecallMode)}
          options={Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <span className="recall-progress-text">
          {index + 1} / {queue.length} 题 · {current.categoryName}
        </span>
        <Tag color={stateTag.color}>{stateTag.label}</Tag>
      </div>

      <Progress
        percent={Math.round(((index + 1) / queue.length) * 100)}
        showInfo={false}
        size="small"
        className="recall-progress"
      />

      <div className="recall-card">
        <div className="recall-question-title">
          <span>{current.title}</span>
          <Tooltip title="朗读本题 30 秒口径">
            <Button
              size="small"
              type="text"
              icon={<SoundOutlined />}
              onClick={() => speak(current.summary || current.content)}
            />
          </Tooltip>
        </div>

        {mode === 'flashcard' && (
          <div className="recall-card-body">
            {!revealed ? (
              <div className="recall-front">
                <p className="recall-hint">
                  {revealCountdown > 0
                    ? `先在心里回忆答案（${revealCountdown} 秒后可翻面）...`
                    : '准备好了就翻面看答案'}
                </p>
                <Button
                  type="primary"
                  size="large"
                  icon={<EyeOutlined />}
                  disabled={revealCountdown > 0}
                  onClick={() => setRevealed(true)}
                >
                  翻面看答案
                </Button>
              </div>
            ) : (
              <div className="recall-back">
                <div className="recall-answer-sections">
                  {current.summary && (
                    <section>
                      <h4>30 秒口径</h4>
                      <p>{current.summary}</p>
                    </section>
                  )}
                  <section>
                    <h4>标准回答</h4>
                    <p className="recall-answer-content">{current.content || current.answer || '（暂无内容）'}</p>
                  </section>
                </div>
                <div className="recall-grade-buttons">
                  {RECALL_GRADE_OPTIONS.map(option => (
                    <Tooltip
                      key={option.grade}
                      title={`${option.hint} · 下次 ${previewIntervalDays(state, option.grade)} 天后`}
                    >
                      <Button
                        type={option.tone}
                        danger={option.grade === 'again'}
                        onClick={() => handleGrade(option.grade)}
                      >
                        {option.label}
                      </Button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'listen' && (
          <div className="recall-card-body">
            <p className="recall-hint">
              听背模式：不看屏幕跟读记忆 30 秒口径，适合通勤场景。点按文字可随时重听。
            </p>
            <div
              className="recall-listen-text"
              onClick={() => speak(current.summary || current.content)}
              role="button"
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  speak(current.summary || current.content)
                }
              }}
            >
              {current.summary || current.content || '（暂无内容）'}
            </div>
            <Space wrap className="recall-grade-buttons">
              <Button
                icon={<SoundOutlined />}
                type={speaking ? 'default' : 'primary'}
                onClick={() => speak(current.summary || current.content)}
              >
                {speaking ? '正在朗读...' : '重新朗读'}
              </Button>
              {speaking && (
                <Button onClick={() => {
                  window.speechSynthesis.cancel()
                  setSpeaking(false)
                }}>
                  停止
                </Button>
              )}
              {RECALL_GRADE_OPTIONS.map(option => (
                <Tooltip
                  key={option.grade}
                  title={`${option.hint} · 下次 ${previewIntervalDays(state, option.grade)} 天后`}
                >
                  <Button
                    type={option.tone}
                    danger={option.grade === 'again'}
                    onClick={() => handleGrade(option.grade)}
                  >
                    {option.label}
                  </Button>
                </Tooltip>
              ))}
            </Space>
          </div>
        )}

        {mode === 'cloze' && (
          <div className="recall-card-body">
            {!clozeDrill ? (
              <Empty description="本题文本太短，不适合挖空默写，换下一题吧。" />
            ) : (
              <>
                <p className="recall-hint">
                  挖空默写（材料：{clozeDrill.sourceLabel}）：凭记忆填出空缺的关键词，提交后自动按 SM-2 排期。
                </p>
                <p className="recall-cloze-text">{clozeDrill.maskedText}</p>
                <Space direction="vertical" className="recall-cloze-inputs" style={{ width: '100%' }}>
                  {clozeDrill.blanks.map((blank, blankIndex) => (
                    <Input
                      key={blankIndex}
                      placeholder={`空 ${blankIndex + 1}${blank.hint ? `（提示：${blank.hint}...）` : ''}`}
                      value={clozeAnswers[blankIndex] ?? ''}
                      onChange={event => {
                        const next = [...clozeAnswers]
                        next[blankIndex] = event.target.value
                        setClozeAnswers(next)
                      }}
                      status={clozeResult ? (clozeResult.details[blankIndex]?.correct ? '' : 'error') : ''}
                    />
                  ))}
                </Space>
                {clozeResult && (
                  <Alert
                    className="recall-cloze-result"
                    type={clozeResult.score >= 80 ? 'success' : clozeResult.score >= 40 ? 'warning' : 'error'}
                    message={`默写得分 ${clozeResult.score} 分（${clozeResult.correct}/${clozeResult.total} 正确）`}
                    description={
                      clozeResult.details
                        .filter(detail => !detail.correct)
                        .map(detail => `空 ${detail.index + 1}：应为「${detail.expected}」${detail.actual ? `，你写了「${detail.actual}」` : '（未作答）'}`)
                        .join('；') || '全部正确，记得保持。'
                    }
                    showIcon
                    icon={<CheckOutlined />}
                  />
                )}
                <Space className="recall-grade-buttons">
                  {!clozeResult ? (
                    <Button
                      type="primary"
                      onClick={handleSubmitCloze}
                      disabled={clozeAnswers.every(answer => !answer?.trim())}
                    >
                      提交默写
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => (index < queue.length - 1 ? goToIndex(index + 1) : goToIndex(0))}
                    >
                      下一题
                    </Button>
                  )}
                </Space>
              </>
            )}
          </div>
        )}
      </div>

      <div className="recall-nav">
        <Button icon={<LeftOutlined />} disabled={index === 0} onClick={() => goToIndex(index - 1)}>
          上一题
        </Button>
        <Button onClick={() => navigate(`/question/${current.id}`)}>查看完整解析</Button>
        <Button disabled={index === queue.length - 1} onClick={() => goToIndex(index + 1)}>
          下一题 <RightOutlined />
        </Button>
      </div>
    </div>
  )
}
