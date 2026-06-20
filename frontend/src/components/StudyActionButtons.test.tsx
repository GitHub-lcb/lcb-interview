import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudyActionButtons from './StudyActionButtons'
import type { QuestionStudyState } from '../types'

function renderButtons(
  state: QuestionStudyState = { status: 'learning', addedToPlan: false, reviewCount: 0 },
) {
  const handlers = {
    onPlanChange: vi.fn(),
    onMarkWeak: vi.fn(),
    onMarkMastered: vi.fn(),
  }

  render(
    <StudyActionButtons
      questionId={42}
      state={state}
      onPlanChange={handlers.onPlanChange}
      onMarkWeak={handlers.onMarkWeak}
      onMarkMastered={handlers.onMarkMastered}
    />,
  )

  return handlers
}

describe('StudyActionButtons', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exposes inactive learning state buttons as toggle controls', () => {
    renderButtons()

    expect(screen.getByRole('button', { name: /加入今日计划/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: /标记薄弱/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: /已掌握/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('exposes active plan, weak and mastered states to assistive technology', () => {
    renderButtons({ status: 'weak', addedToPlan: true, reviewCount: 2 })

    expect(screen.getByRole('button', { name: /已在今日计划/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /标记薄弱/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /已掌握/ })).toHaveAttribute('aria-pressed', 'false')

    cleanup()

    renderButtons({ status: 'mastered', addedToPlan: true, reviewCount: 3 })

    expect(screen.getByRole('button', { name: /已在今日计划/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /标记薄弱/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: /已掌握/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('uses clean accessible names without icon noise', () => {
    renderButtons()

    expect(screen.getByRole('button', { name: '加入今日计划' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '标记薄弱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已掌握' })).toBeInTheDocument()

    cleanup()

    renderButtons({ status: 'weak', addedToPlan: true, reviewCount: 2 })

    expect(screen.getByRole('button', { name: '已在今日计划' })).toBeInTheDocument()
  })

  it('keeps card navigation isolated when changing study state', async () => {
    const user = userEvent.setup()
    const handlers = renderButtons()

    await user.click(screen.getByRole('button', { name: /加入今日计划/ }))
    await user.click(screen.getByRole('button', { name: /标记薄弱/ }))
    await user.click(screen.getByRole('button', { name: /已掌握/ }))

    expect(handlers.onPlanChange).toHaveBeenCalledWith(42, true)
    expect(handlers.onMarkWeak).toHaveBeenCalledWith(42)
    expect(handlers.onMarkMastered).toHaveBeenCalledWith(42)
  })
})
