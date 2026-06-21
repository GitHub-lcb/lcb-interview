import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox } from 'antd'
import { CopyOutlined, EyeInvisibleOutlined, EyeOutlined, PlayCircleOutlined, SoundOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import {
  buildInterviewAnswerScript,
  buildInterviewAnswerScriptMarkdown,
  buildInterviewAnswerSpeechText,
} from '../utils/interviewAnswerScript'
import type { Question } from '../types'

interface Props {
  question: Question
  isPracticeCalibrationReturn?: boolean
  practiceCalibrationSummary?: PracticeCalibrationSummary
}

interface PracticeCalibrationSummary {
  score: number
  weakestLabel?: string
}

const REHEARSAL_SECONDS = 60
const ACCEPTANCE_ITEMS = [
  { key: 'conclusion', label: '结论一句话' },
  { key: 'mechanism', label: '机制说清' },
  { key: 'scenarioRisk', label: '场景和风险补全' },
] as const

type AcceptanceKey = typeof ACCEPTANCE_ITEMS[number]['key']
type AcceptanceState = Record<AcceptanceKey, boolean>

const EMPTY_ACCEPTANCE: AcceptanceState = {
  conclusion: false,
  mechanism: false,
  scenarioRisk: false,
}

export default function InterviewAnswerScriptPanel({
  question,
  isPracticeCalibrationReturn = false,
  practiceCalibrationSummary,
}: Props) {
  const navigate = useNavigate()
  const script = buildInterviewAnswerScript(question)
  const [timeLeft, setTimeLeft] = useState(REHEARSAL_SECONDS)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [blindMode, setBlindMode] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const [acceptance, setAcceptance] = useState<AcceptanceState>(EMPTY_ACCEPTANCE)
  const [acceptanceNotified, setAcceptanceNotified] = useState(false)
  const acceptanceCount = ACCEPTANCE_ITEMS.filter(item => acceptance[item.key]).length
  const acceptanceComplete = acceptanceCount === ACCEPTANCE_ITEMS.length

  const updateSpeaking = (nextSpeaking: boolean) => {
    speakingRef.current = nextSpeaking
    setSpeaking(nextSpeaking)
  }

  useEffect(() => {
    if (!running) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setTimeLeft(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          setRunning(false)
          setCompleted(true)
          emitFeedbackSuccess('60 秒复述结束，马上按验收点自查')
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!blindMode || !acceptanceComplete || acceptanceNotified) {
      return
    }

    emitFeedbackSuccess('盲练验收完成，可以进入模拟面试')
    setAcceptanceNotified(true)
  }, [acceptanceComplete, acceptanceNotified, blindMode])

  useEffect(() => () => {
    if (speakingRef.current && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const handleCopy = async () => {
    const markdown = buildInterviewAnswerScriptMarkdown(question)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('60 秒面试口径已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(question.title))
    emitFeedbackWarning('剪贴板不可用，已下载 60 秒面试口径')
  }

  const handleSpeak = () => {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      emitFeedbackWarning('当前浏览器不支持语音朗读，可复制口径自行练习')
      return
    }

    const utterance = new SpeechSynthesisUtterance(buildInterviewAnswerSpeechText(question))
    utterance.lang = 'zh-CN'
    utterance.rate = 0.96
    utterance.onend = () => updateSpeaking(false)
    utterance.onerror = () => updateSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    updateSpeaking(true)
    emitFeedbackSuccess('正在朗读 60 秒面试口径')
  }

  const handleStopSpeak = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    updateSpeaking(false)
    emitFeedbackSuccess('已停止朗读')
  }

  const handleStartRehearsal = () => {
    setTimeLeft(REHEARSAL_SECONDS)
    setCompleted(false)
    setRunning(true)
    emitFeedbackSuccess('60 秒复述开始，先说结论再展开三段要点')
  }

  const handleToggleBlindMode = () => {
    setBlindMode(current => {
      const next = !current
      if (next) {
        setAcceptance(EMPTY_ACCEPTANCE)
        setAcceptanceNotified(false)
      }
      emitFeedbackSuccess(next ? '盲练已开启，先按提示复述再看答案' : '已显示 60 秒面试口径')
      return next
    })
  }

  const handleAcceptanceChange = (key: AcceptanceKey, checked: boolean) => {
    setAcceptance(current => ({
      ...current,
      [key]: checked,
    }))
    if (!checked) {
      setAcceptanceNotified(false)
    }
  }

  const handleStartMockInterview = () => {
    navigate(`/practice?question=${question.id}&from=script`)
  }

  return (
    <section id="answer-script" className="interview-answer-script-panel" aria-label="60 秒面试口径" tabIndex={-1}>
      <div className="interview-answer-script-head">
        <div>
          <div className="panel-kicker">开口练习</div>
          <h2>60 秒面试口径</h2>
        </div>
        <div className="interview-answer-script-actions">
          <Button
            size="small"
            danger={speaking}
            icon={speaking ? <StopOutlined /> : <SoundOutlined />}
            onClick={speaking ? handleStopSpeak : handleSpeak}
          >
            {speaking ? '停止朗读' : '朗读口径'}
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
            复制口径
          </Button>
          <Button
            size="small"
            icon={blindMode ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={handleToggleBlindMode}
          >
            {blindMode ? '显示口径' : '开启盲练'}
          </Button>
        </div>
      </div>

      {isPracticeCalibrationReturn ? (
        <div className="interview-answer-script-calibration-cue" aria-label="评分后回修提示">
          <span>评分后回修</span>
          {practiceCalibrationSummary ? (
            <small>
              最近 {practiceCalibrationSummary.score} 分
              {practiceCalibrationSummary.weakestLabel ? ` · 优先补${practiceCalibrationSummary.weakestLabel}` : ''}
            </small>
          ) : null}
          <strong>先对照口径补齐最低分缺口，再开启盲练复述。</strong>
        </div>
      ) : null}

      {blindMode ? (
        <div className="interview-answer-script-blind" aria-live="polite">
          <span>盲练中</span>
          <strong>按提示复述，不看原文</strong>
          <ul>
            <li>先给结论</li>
            <li>再讲机制</li>
            <li>最后补场景和风险</li>
          </ul>
        </div>
      ) : (
        <p className="interview-answer-script-opening">{script.opening}</p>
      )}

      <div className="interview-answer-script-rehearsal">
        <div>
          <span>{running ? '复述中' : completed ? '复述完成' : '计时复述'}</span>
          <strong>剩余 {timeLeft} 秒</strong>
          <small>按 60 秒真实面试节奏复述：结论、机制、场景、落地、误区。</small>
        </div>
        <Button size="small" icon={<ThunderboltOutlined />} onClick={handleStartRehearsal}>
          {running ? '重开复述' : '开始复述'}
        </Button>
      </div>

      <div className="interview-answer-script-grid">
        {script.keyPoints.map(point => (
          <div key={point.label} className={`interview-answer-script-point${blindMode ? ' blind' : ''}`}>
            <span>{point.label}</span>
            {blindMode ? <p>先自己说出这一段，再显示口径校准。</p> : <p>{point.text}</p>}
          </div>
        ))}
      </div>

      <div className="interview-answer-script-bottom">
        <div>
          <span>误区防线</span>
          <p>{blindMode ? '说完后再核对误区防线。' : script.riskLine}</p>
        </div>
        <div>
          <span>高频追问</span>
          <p>{blindMode ? '先预判一道追问，复述完再展开回答。' : script.followUps[0]}</p>
        </div>
      </div>

      {blindMode ? (
        <div className={`interview-answer-script-acceptance${acceptanceComplete ? ' complete' : ''}`} aria-label="盲练复述验收">
          <div className="interview-answer-script-acceptance-head">
            <div>
              <span>复述验收</span>
              <strong>{acceptanceCount} / {ACCEPTANCE_ITEMS.length}</strong>
            </div>
            <small>{acceptanceComplete ? '本轮可进入模拟面试' : '先完成三项自查，再进入模拟面试。'}</small>
          </div>
          <div className="interview-answer-script-acceptance-list">
            {ACCEPTANCE_ITEMS.map(item => (
              <Checkbox
                key={item.key}
                checked={acceptance[item.key]}
                onChange={event => handleAcceptanceChange(item.key, event.target.checked)}
              >
                {item.label}
              </Checkbox>
            ))}
          </div>
          {acceptanceComplete ? (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={handleStartMockInterview}
              className="interview-answer-script-acceptance-action"
            >
              进入模拟面试
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
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

function buildFileName(title: string): string {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeTitle || '题目'}-60秒面试口径.md`
}
