import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedbackMessageBridge from './FeedbackMessageBridge'
import { FEEDBACK_MESSAGE_EVENT } from '../utils/feedbackMessage'

const { messageError, messageSuccess, messageWarning } = vi.hoisted(() => ({
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
}))

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          error: messageError,
          success: messageSuccess,
          warning: messageWarning,
        },
      }),
    },
  }
})

describe('FeedbackMessageBridge', () => {
  beforeEach(() => {
    messageError.mockReset()
    messageSuccess.mockReset()
    messageWarning.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows feedback errors through the Ant Design App message context', () => {
    render(<FeedbackMessageBridge />)

    window.dispatchEvent(new CustomEvent(FEEDBACK_MESSAGE_EVENT, {
      detail: {
        type: 'error',
        content: '网络错误，请稍后重试',
      },
    }))

    expect(messageError).toHaveBeenCalledWith('网络错误，请稍后重试')
  })

  it('shows success and warning feedback through the Ant Design App message context', () => {
    render(<FeedbackMessageBridge />)

    window.dispatchEvent(new CustomEvent(FEEDBACK_MESSAGE_EVENT, {
      detail: {
        type: 'success',
        content: '答题脚手架已复制',
      },
    }))
    window.dispatchEvent(new CustomEvent(FEEDBACK_MESSAGE_EVENT, {
      detail: {
        type: 'warning',
        content: '剪贴板不可用，已下载 Markdown 脚手架',
      },
    }))

    expect(messageSuccess).toHaveBeenCalledWith('答题脚手架已复制')
    expect(messageWarning).toHaveBeenCalledWith('剪贴板不可用，已下载 Markdown 脚手架')
    expect(messageError).not.toHaveBeenCalled()
  })
})
