import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import axios from 'axios'
import AdminLayout from './AdminLayout'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location">{location.pathname}</div>
}

function AdminChildProbe({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount()
  }, [onMount])

  return <div>admin child route</div>
}

describe('AdminLayout', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(axios.get).mockReset()

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

  it('redirects to login before rendering admin child routes when token is missing', async () => {
    const childMounted = vi.fn()

    render(
      <MemoryRouter
        initialEntries={['/admin/dashboard']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/admin/login" element={<LocationProbe />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminChildProbe onMount={childMounted} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(childMounted).not.toHaveBeenCalled()
    expect(screen.queryByText('admin child route')).not.toBeInTheDocument()
    expect(await screen.findByTestId('location')).toHaveTextContent('/admin/login')
  })

  it('verifies stored token before rendering admin child routes', async () => {
    const childMounted = vi.fn()
    localStorage.setItem('adminToken', 'valid-token')
    vi.mocked(axios.get).mockResolvedValue({ data: { code: 200 } })

    render(
      <MemoryRouter
        initialEntries={['/admin/dashboard']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/admin/login" element={<LocationProbe />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminChildProbe onMount={childMounted} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(childMounted).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/admin/verify', {
        headers: { Authorization: 'Bearer valid-token' },
      })
    })
    expect(await screen.findByText('admin child route')).toBeInTheDocument()
    expect(childMounted).toHaveBeenCalledTimes(1)
  })

  it('clears stale token and redirects to login when verification fails', async () => {
    const childMounted = vi.fn()
    localStorage.setItem('adminToken', 'stale-token')
    vi.mocked(axios.get).mockRejectedValue(new Error('Unauthorized'))

    render(
      <MemoryRouter
        initialEntries={['/admin/dashboard']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/admin/login" element={<LocationProbe />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminChildProbe onMount={childMounted} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/admin/verify', {
        headers: { Authorization: 'Bearer stale-token' },
      })
    })
    expect(await screen.findByTestId('location')).toHaveTextContent('/admin/login')
    expect(localStorage.getItem('adminToken')).toBeNull()
    expect(childMounted).not.toHaveBeenCalled()
  })
})
