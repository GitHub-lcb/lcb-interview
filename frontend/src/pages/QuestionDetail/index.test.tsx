import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { getQuestionById } from '../../api/question'
import { FEEDBACK_MESSAGE_EVENT, type FeedbackMessageDetail } from '../../utils/feedbackMessage'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import QuestionDetail from './index'

const fixtures = vi.hoisted(() => ({
  question: {
    id: 101,
    title: 'Java 中的序列化是什么？',
    content: '序列化是把对象转换成可传输或可存储格式的过程。',
    summary: '序列化是把对象转换成字节流，方便网络传输或磁盘持久化。',
    principle: '核心机制是把对象字段按协议编码，并在反序列化时重建对象状态。',
    scenario: '常见于 RPC、缓存落盘和消息队列传输。',
    risk: '不要把所有字段都默认序列化，敏感字段和兼容性要单独设计。',
    projectExp: '项目里会固定 serialVersionUID，并为跨版本字段设置默认值。',
    difficulty: 'MEDIUM',
    categoryName: 'Java 基础',
    categoryId: 1,
    tags: ['Java', '序列化'],
    viewCount: 120,
    createTime: '2026-06-20T00:00:00.000Z',
  },
}))

vi.mock('../../api/question', () => ({
  getQuestionById: vi.fn().mockResolvedValue(fixtures.question),
}))

function PracticeLocationProbe() {
  const location = useLocation()

  return <div aria-label="模拟面试页面">模拟面试页面 {location.search}</div>
}

describe('QuestionDetail', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads the detail silently because the page owns its inline failure state', async () => {
    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestionById)).toHaveBeenCalledWith(101, { silentGlobalError: true })
    })
  })

  it.each(['/question/abc', '/question/2.5', '/question/0'])(
    'rejects invalid question route %s without requesting backend data',
    async (entry) => {
      render(
        <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/question/:id" element={<QuestionDetail />} />
          </Routes>
        </MemoryRouter>,
      )

      expect(await screen.findByText('题目地址无效')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '返回题库' })).toBeInTheDocument()
      expect(vi.mocked(getQuestionById)).not.toHaveBeenCalled()
    },
  )

  it('shows and copies the 60 second interview answer script', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
    })

    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')
    expect(within(scriptPanel).getByText('60 秒面试口径')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('序列化是把对象转换成字节流，方便网络传输或磁盘持久化。')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('误区防线')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /复制口径/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(writeText.mock.calls[0][0]).toContain('# Java 中的序列化是什么？ 60 秒面试口径')
    expect(writeText.mock.calls[0][0]).toContain('## 三段展开')
  })

  it('exposes answer sections as accessible disclosure controls', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const standardAnswer = await screen.findByRole('button', { name: /标准回答/ })
    expect(standardAnswer).toHaveAttribute('aria-expanded', 'true')

    const panelId = standardAnswer.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    expect(document.getElementById(panelId!)).toHaveTextContent('序列化是把对象转换成可传输或可存储格式的过程。')

    standardAnswer.focus()
    await user.keyboard('{Enter}')

    expect(standardAnswer).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(panelId!)).not.toBeInTheDocument()
  })

  it('scrolls to the answer script when opened with the script hash', async () => {
    render(
      <MemoryRouter initialEntries={['/question/101#answer-script']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')

    await waitFor(() => {
      expect(scriptPanel).toHaveAttribute('id', 'answer-script')
      expect(scriptPanel).toHaveFocus()
      expect(scriptPanel.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    })
  })

  it('shows a post-score calibration cue when returning from practice feedback', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      interviewAttempts: {
        101: [
          {
            questionId: 101,
            answer: '结论：序列化用于对象传输。',
            createdAt: '2026-06-20T08:00:00.000Z',
            feedback: {
              score: 52,
              level: 'needs-work',
              source: 'LOCAL_RULE_BASED',
              criteria: [
                { key: 'coverage', label: '知识覆盖', score: 62, summary: '覆盖一般' },
                { key: 'structure', label: '表达结构', score: 38, summary: '结构不足' },
                { key: 'specificity', label: '场景细节', score: 55, summary: '场景不足' },
                { key: 'risk', label: '边界风险', score: 58, summary: '风险不足' },
              ],
              advice: [],
              followUps: [],
            },
          },
        ],
      },
    }))

    render(
      <MemoryRouter initialEntries={['/question/101?from=practice-calibration#answer-script']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')

    expect(within(scriptPanel).getByText('评分后回修')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('最近 52 分 · 优先补表达结构')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('先对照口径补齐最低分缺口，再开启盲练复述。')).toBeInTheDocument()
    expect(within(scriptPanel).getByRole('button', { name: /开启盲练/ })).toBeInTheDocument()
  })

  it('reads the 60 second interview answer script aloud when speech is available', async () => {
    const user = userEvent.setup()
    const cancel = vi.fn()
    const speak = vi.fn()
    const utterances: Array<{ text: string, lang?: string, rate?: number }> = []
    const SpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => {
      const utterance = { text, lang: '', rate: 0 }
      utterances.push(utterance)
      return utterance
    })
    vi.stubGlobal('speechSynthesis', { cancel, speak })
    vi.stubGlobal('SpeechSynthesisUtterance', SpeechSynthesisUtterance)

    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')
    await user.click(within(scriptPanel).getByRole('button', { name: /朗读口径/ }))

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(1)
    expect(utterances[0]).toMatchObject({ lang: 'zh-CN', rate: 0.96 })
    expect(utterances[0].text).toContain('题目，Java 中的序列化是什么？')
    expect(utterances[0].text).toContain('开场，序列化是把对象转换成字节流')
  })

  it('runs a 60 second oral rehearsal timer and prompts self check after finishing', async () => {
    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')
    expect(within(scriptPanel).getByText('剩余 60 秒')).toBeInTheDocument()

    vi.useFakeTimers()
    const feedbackMessages: string[] = []
    const onFeedback = (event: Event) => {
      feedbackMessages.push((event as CustomEvent<FeedbackMessageDetail>).detail.content)
    }
    window.addEventListener(FEEDBACK_MESSAGE_EVENT, onFeedback)

    try {
      fireEvent.click(within(scriptPanel).getByRole('button', { name: /开始复述/ }))
      expect(within(scriptPanel).getByText('复述中')).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      expect(within(scriptPanel).getByText('剩余 59 秒')).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(59000)
      })
      expect(within(scriptPanel).getByText('复述完成')).toBeInTheDocument()
      expect(feedbackMessages).toContain('60 秒复述结束，马上按验收点自查')
    } finally {
      window.removeEventListener(FEEDBACK_MESSAGE_EVENT, onFeedback)
    }
  })

  it('hides the answer text during blind rehearsal and restores it afterwards', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')
    expect(within(scriptPanel).getByText('序列化是把对象转换成字节流，方便网络传输或磁盘持久化。')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('不要把所有字段都默认序列化，敏感字段和兼容性要单独设计。')).toBeInTheDocument()

    await user.click(within(scriptPanel).getByRole('button', { name: /开启盲练/ }))

    expect(within(scriptPanel).getByText('盲练中')).toBeInTheDocument()
    expect(within(scriptPanel).queryByText('序列化是把对象转换成字节流，方便网络传输或磁盘持久化。')).not.toBeInTheDocument()
    expect(within(scriptPanel).queryByText('不要把所有字段都默认序列化，敏感字段和兼容性要单独设计。')).not.toBeInTheDocument()
    expect(within(scriptPanel).getByText('按提示复述，不看原文')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('先给结论')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('再讲机制')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('最后补场景和风险')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('说完后再核对误区防线。')).toBeInTheDocument()

    await user.click(within(scriptPanel).getByRole('button', { name: /显示口径/ }))

    expect(within(scriptPanel).getByText('序列化是把对象转换成字节流，方便网络传输或磁盘持久化。')).toBeInTheDocument()
    expect(within(scriptPanel).getByText('不要把所有字段都默认序列化，敏感字段和兼容性要单独设计。')).toBeInTheDocument()
    expect(within(scriptPanel).queryByText('盲练中')).not.toBeInTheDocument()
  })

  it('tracks blind rehearsal acceptance checks before moving to mock interview', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')
    await user.click(within(scriptPanel).getByRole('button', { name: /开启盲练/ }))

    const acceptance = within(scriptPanel).getByLabelText('盲练复述验收')
    expect(within(acceptance).getByText('复述验收')).toBeInTheDocument()
    expect(within(acceptance).getByText('0 / 3')).toBeInTheDocument()
    expect(within(acceptance).getByText('先完成三项自查，再进入模拟面试。')).toBeInTheDocument()

    await user.click(within(acceptance).getByRole('checkbox', { name: '结论一句话' }))
    await user.click(within(acceptance).getByRole('checkbox', { name: '机制说清' }))
    expect(within(acceptance).getByText('2 / 3')).toBeInTheDocument()

    await user.click(within(acceptance).getByRole('checkbox', { name: '场景和风险补全' }))
    expect(within(acceptance).getByText('3 / 3')).toBeInTheDocument()
    expect(within(acceptance).getByText('本轮可进入模拟面试')).toBeInTheDocument()
  })

  it('moves from completed blind rehearsal acceptance into mock interview', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/question/101']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
          <Route path="/practice" element={<PracticeLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    const scriptPanel = await screen.findByLabelText('60 秒面试口径')
    await user.click(within(scriptPanel).getByRole('button', { name: /开启盲练/ }))

    const acceptance = within(scriptPanel).getByLabelText('盲练复述验收')
    expect(within(acceptance).queryByRole('button', { name: /进入模拟面试/ })).not.toBeInTheDocument()

    await user.click(within(acceptance).getByRole('checkbox', { name: '结论一句话' }))
    await user.click(within(acceptance).getByRole('checkbox', { name: '机制说清' }))
    await user.click(within(acceptance).getByRole('checkbox', { name: '场景和风险补全' }))

    await user.click(within(acceptance).getByRole('button', { name: /进入模拟面试/ }))

    expect(screen.getByLabelText('模拟面试页面')).toHaveTextContent('模拟面试页面 ?question=101&from=script')
  })
})
