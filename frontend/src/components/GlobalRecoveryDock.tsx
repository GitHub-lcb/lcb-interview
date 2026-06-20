import { ArrowRightOutlined, EditOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildPracticeDraftRecovery } from '../utils/practiceDraftRecovery'
import {
  PRACTICE_ANSWER_DRAFT_EVENT,
  readPracticeAnswerDrafts,
  type PracticeAnswerDraft,
} from '../utils/practiceAnswerDraftStore'

const DISMISSED_SIGNATURE_KEY = 'lcb-interview-global-recovery-dismissed-signature'

export default function GlobalRecoveryDock() {
  const navigate = useNavigate()
  const location = useLocation()
  const { progress } = useStudyProgress()
  const [drafts, setDrafts] = useState<PracticeAnswerDraft[]>(() => readPracticeAnswerDrafts())
  const [dismissedSignature, setDismissedSignature] = useState(() => readDismissedSignature())

  useEffect(() => {
    const refresh = () => setDrafts(readPracticeAnswerDrafts())
    window.addEventListener('storage', refresh)
    window.addEventListener(PRACTICE_ANSWER_DRAFT_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(PRACTICE_ANSWER_DRAFT_EVENT, refresh)
    }
  }, [])

  const recovery = useMemo(
    () => buildPracticeDraftRecovery(progress, { drafts, limit: 2 }),
    [drafts, progress],
  )
  const draftSignature = useMemo(() => buildDraftSignature(drafts), [drafts])

  const hideCurrentRecovery = () => {
    if (!draftSignature) {
      return
    }

    setDismissedSignature(draftSignature)
    persistDismissedSignature(draftSignature)
  }

  if (
    location.pathname.startsWith('/practice')
    || recovery.items.length === 0
    || dismissedSignature === draftSignature
  ) {
    return null
  }

  const primaryItem = recovery.items[0]

  return (
    <section className="global-recovery-dock" aria-label="全站未提交回答恢复">
      <div className="global-recovery-dock-main">
        <div className="global-recovery-dock-icon">
          <EditOutlined />
        </div>
        <div>
          <h2>继续未完成训练</h2>
          <p>
            <strong>{recovery.items.length} 份回答草稿待评分</strong>
            <span>{primaryItem.title}</span>
          </p>
        </div>
      </div>

      <div className="global-recovery-dock-actions">
        <Button size="small" onClick={() => navigate('/study')}>
          查看计划
        </Button>
        <Button size="small" onClick={hideCurrentRecovery}>
          本次先隐藏
        </Button>
        <Button size="small" type="primary" onClick={() => navigate(recovery.primaryPath)}>
          恢复 {recovery.items.length} 份草稿
          <ArrowRightOutlined />
        </Button>
      </div>
    </section>
  )
}

function buildDraftSignature(drafts: PracticeAnswerDraft[]): string {
  return drafts
    .map(draft => `${draft.questionId}:${draft.updatedAt}:${draft.draft.length}`)
    .join('|')
}

function readDismissedSignature(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISSED_SIGNATURE_KEY)
  } catch {
    return null
  }
}

function persistDismissedSignature(signature: string): void {
  try {
    window.sessionStorage.setItem(DISMISSED_SIGNATURE_KEY, signature)
  } catch {
    // 会话存储不可用时仍允许用户在当前渲染周期内隐藏提示。
  }
}
