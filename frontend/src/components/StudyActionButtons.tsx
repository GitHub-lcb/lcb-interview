import { Button, Space } from 'antd'
import { CheckOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import type { QuestionStudyState } from '../types'

interface Props {
  questionId: number
  state: QuestionStudyState
  onPlanChange: (questionId: number, added: boolean) => void
  onMarkWeak: (questionId: number) => void
  onMarkMastered: (questionId: number) => void
  compact?: boolean
}

export default function StudyActionButtons({
  questionId,
  state,
  onPlanChange,
  onMarkWeak,
  onMarkMastered,
  compact = false,
}: Props) {
  return (
    <Space size={compact ? 4 : 8} wrap>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={<PlusOutlined />}
        type={state.addedToPlan ? 'primary' : 'default'}
        aria-label={state.addedToPlan ? '已在今日计划' : '加入今日计划'}
        aria-pressed={state.addedToPlan}
        onClick={(event) => {
          event.stopPropagation()
          onPlanChange(questionId, !state.addedToPlan)
        }}
      >
        {state.addedToPlan ? '已在今日计划' : '加入今日计划'}
      </Button>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={<WarningOutlined />}
        danger={state.status === 'weak'}
        aria-label="标记薄弱"
        aria-pressed={state.status === 'weak'}
        onClick={(event) => {
          event.stopPropagation()
          onMarkWeak(questionId)
        }}
      >
        标记薄弱
      </Button>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={<CheckOutlined />}
        aria-label="已掌握"
        aria-pressed={state.status === 'mastered'}
        onClick={(event) => {
          event.stopPropagation()
          onMarkMastered(questionId)
        }}
      >
        已掌握
      </Button>
    </Space>
  )
}
