import { useEffect } from 'react'
import { App as AntdApp } from 'antd'
import { FEEDBACK_MESSAGE_EVENT, type FeedbackMessageDetail } from '../utils/feedbackMessage'

export default function FeedbackMessageBridge() {
  const { message } = AntdApp.useApp()

  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const detail = (event as CustomEvent<FeedbackMessageDetail>).detail
      if (!detail?.content) {
        return
      }
      if (detail.type === 'success') {
        message.success(detail.content)
        return
      }
      if (detail.type === 'warning') {
        message.warning(detail.content)
        return
      }
      if (detail.type === 'error') {
        message.error(detail.content)
      }
    }

    window.addEventListener(FEEDBACK_MESSAGE_EVENT, handleFeedback)
    return () => {
      window.removeEventListener(FEEDBACK_MESSAGE_EVENT, handleFeedback)
    }
  }, [message])

  return null
}
