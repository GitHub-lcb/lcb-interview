import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import DailyMissionPanel from './DailyMissionPanel'

const { navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

describe('DailyMissionPanel', () => {
  beforeEach(() => {
    navigate.mockReset()
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(createDefaultProgress('2026-06-21T00:00:00.000Z')))
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
  })

  it('shows concrete action labels instead of generic execution buttons', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DailyMissionPanel />
      </MemoryRouter>,
    )

    const panel = screen.getByLabelText('今日冲刺任务')
    expect(within(panel).queryByRole('button', { name: '开始执行' })).not.toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: /开始首次面试/ }))

    expect(navigate).toHaveBeenCalledWith('/practice')
  })
})
