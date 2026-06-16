import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminLayout from './AdminLayout'

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
  beforeEach(() => {
    localStorage.clear()

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
})
