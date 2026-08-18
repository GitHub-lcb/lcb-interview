import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Tools from './index'
import { getCurrentUser } from '../../api/auth'
import { USER_TOKEN_STORAGE_KEY } from '../../utils/authToken'

const panelRenderSpies = vi.hoisted(() => ({
  lottery: vi.fn(),
  ssq: vi.fn(),
  dlt: vi.fn(),
  reading: vi.fn(),
}))

vi.mock('../../api/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('../../components/ReadingExcerptPanel', () => ({
  default: () => {
    panelRenderSpies.reading()

    return <div data-testid="reading-panel">reading</div>
  },
}))

vi.mock('../../components/LotteryKl8Panel', () => ({
  default: () => {
    panelRenderSpies.lottery()

    return <div data-testid="lottery-panel">lottery</div>
  },
}))

vi.mock('../../components/SsqPanel', () => ({
  default: () => {
    panelRenderSpies.ssq()

    return <div data-testid="ssq-panel">ssq</div>
  },
}))

vi.mock('../../components/DltPanel', () => ({
  default: () => {
    panelRenderSpies.dlt()

    return <div data-testid="dlt-panel">dlt</div>
  },
}))

vi.mock('../../components/SimulationPanel', () => ({
  default: () => <div data-testid="simulation-panel">simulation</div>,
}))

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location">{location.pathname}</div>
}

function renderTools(initialEntry = '/tools') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth/login" element={<LocationProbe />} />
        <Route path="/tools" element={<Tools />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Tools page auth gate', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('does not mount protected tool panels before current user is verified', () => {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, 'valid-token')
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}))

    renderTools()

    expect(screen.queryByTestId('reading-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('lottery-panel')).not.toBeInTheDocument()
  })

  it('does not mount protected tool panels when token is missing', () => {
    renderTools()

    expect(panelRenderSpies.reading).not.toHaveBeenCalled()
    expect(panelRenderSpies.lottery).not.toHaveBeenCalled()
    expect(panelRenderSpies.ssq).not.toHaveBeenCalled()
    expect(panelRenderSpies.dlt).not.toHaveBeenCalled()
  })

  it('mounts lottery prediction as the default protected tool panel after current user is verified', async () => {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, 'valid-token')
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'chenbo',
      displayName: 'Chen Bo',
    })

    renderTools()

    await waitFor(() => {
      expect(screen.getByTestId('lottery-panel')).toBeInTheDocument()
    })
    expect(panelRenderSpies.lottery).toHaveBeenCalled()
  })

  it('keeps three primary tabs and switches lottery games inside prediction', async () => {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, 'valid-token')
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'chenbo',
      displayName: 'Chen Bo',
    })

    renderTools()

    await screen.findByTestId('lottery-panel')
    const primaryTabs = screen.getAllByRole('tab')
    expect(primaryTabs.map(tab => tab.textContent?.trim())).toEqual(['号码预测', '模拟战场', '书摘库'])

    await userEvent.click(screen.getByText('双色球'))
    expect(screen.getByTestId('ssq-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('lottery-panel')).not.toBeInTheDocument()
  })
})
