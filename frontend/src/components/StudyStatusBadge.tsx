import type { StudyQuestionStatus } from '../types'

const meta: Record<StudyQuestionStatus, { label: string; bg: string; color: string }> = {
  new: { label: '未学', bg: '#E7ECEF', color: '#586069' },
  learning: { label: '学习中', bg: '#E7F3EC', color: '#0F8A8F' },
  weak: { label: '薄弱', bg: '#FEF2F2', color: '#DC2626' },
  mastered: { label: '已掌握', bg: '#ECFDF5', color: '#059669' },
}

interface Props {
  status: StudyQuestionStatus
  addedToPlan?: boolean
}

export default function StudyStatusBadge({ status, addedToPlan }: Props) {
  const item = meta[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 6,
      background: item.bg,
      color: item.color,
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
    }}>
      {item.label}{addedToPlan ? ' · 今日' : ''}
    </span>
  )
}
