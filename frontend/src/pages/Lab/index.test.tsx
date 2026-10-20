import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Lab from './index'
import { getCurrentUser } from '../../api/auth'
import { USER_TOKEN_STORAGE_KEY } from '../../utils/authToken'

const panelRenderSpies = vi.hoisted(() => ({
  lottery: vi.fn(),
  simulation: vi.fn(),
}))

vi.mock('../../api/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('../../components/LotteryKl8Panel', () => ({
  default: () => {
    panelRenderSpies.lottery()

    return <div data-testid="lottery-panel">lottery</div>
  },
}))

vi.mock('../../components/SimulationPanel', () => ({
  default: () => {
    panelRenderSpies.simulation()

    return <div data-testid="simulation-panel">simulation</div>
  },
}))

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderLab(initialEntry = '/lab') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth/login" element={<LocationProbe />} />
        <Route path="/lab" element={<Lab />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Lab page auth gate', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('does not mount protected experiment panels before current user is verified', () => {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, 'valid-token')
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}))

    renderLab()

    expect(screen.queryByTestId('lottery-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('simulation-panel')).not.toBeInTheDocument()
  })

  it('does not mount protected experiment panels when token is missing', () => {
    renderLab()

    expect(panelRenderSpies.lottery).not.toHaveBeenCalled()
    expect(panelRenderSpies.simulation).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated visitors back to the lab entry after login', async () => {
    renderLab()

    expect(await screen.findByTestId('location')).toHaveTextContent('/auth/login?from=/lab')
  })

  it('mounts the KL8 experiment as the default lab entry and states its scope', async () => {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, 'valid-token')
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'chenbo',
      displayName: 'Chen Bo',
    })

    renderLab()

    await waitFor(() => {
      expect(screen.getByTestId('lottery-panel')).toBeInTheDocument()
    })
    expect(panelRenderSpies.lottery).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '实验室' })).toBeInTheDocument()
    expect(screen.getByText('实验性功能，不进入主导航主线')).toBeInTheDocument()
    expect(screen.getByText(/不构成投注建议/)).toBeInTheDocument()
  })

  it('keeps only the KL8 experiment and the KL8 simulation battlefield', async () => {
    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, 'valid-token')
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'chenbo',
      displayName: 'Chen Bo',
    })

    renderLab()

    await screen.findByTestId('lottery-panel')
    const primaryTabs = screen.getAllByRole('tab')
    expect(primaryTabs.map(tab => tab.textContent?.trim())).toEqual(['号码预测', '模拟战场'])
    // 号码预测内不再有彩种切换，双色球/大乐透入口已移除
    expect(screen.queryByText('双色球')).not.toBeInTheDocument()
    expect(screen.queryByText('大乐透')).not.toBeInTheDocument()
    expect(screen.queryByText('书摘库')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /模拟战场/ }))
    expect(await screen.findByTestId('simulation-panel')).toBeInTheDocument()
  })
})
