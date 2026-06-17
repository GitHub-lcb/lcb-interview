import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import Experiences from './index'

describe('Experiences', () => {
  beforeEach(() => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify({
      ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
      targetRole: 'Java 后端',
    }))
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
    vi.clearAllMocks()
  })

  it('copies the interview experience playbook markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Experiences />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制场景包/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# Java 后端 真实面试场景包')
    expect(markdown).toContain('## 场景题单')
    expect(markdown).toContain('大厂 Java 后端面试组')
    expect(markdown).toContain('/practice')
  })
})
