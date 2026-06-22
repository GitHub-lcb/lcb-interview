export const FEEDBACK_MESSAGE_EVENT = 'lcb:feedback-message'

export interface FeedbackMessageDetail {
  type: 'success' | 'warning' | 'error'
  content: string
}

function emitFeedbackMessage(detail: FeedbackMessageDetail): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent<FeedbackMessageDetail>(FEEDBACK_MESSAGE_EVENT, {
    detail,
  }))
}

export function emitFeedbackSuccess(content: string): void {
  emitFeedbackMessage({ type: 'success', content })
}

export function emitFeedbackWarning(content: string): void {
  emitFeedbackMessage({ type: 'warning', content })
}

export function emitFeedbackError(content: string): void {
  emitFeedbackMessage({ type: 'error', content })
}
