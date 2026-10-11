import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../../src/pages/Dashboard'

vi.mock('../../src/lib/api', () => ({
  reportsApi: {
    getDashboard: vi.fn().mockResolvedValue({ data: { data: {} } }),
    getExpensesByCategory: vi.fn().mockResolvedValue({ data: { data: { expenses: [] } } }),
    getProjections: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
  accountsApi: {
    getAll: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}))

vi.mock('../../src/hooks/useFormatters', () => ({
  useFormatters: () => ({ formatCurrency: (value) => String(value), formatDateRelative: (value) => value }),
}))

describe('Dashboard BPO workflows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('provides routine shortcuts and guides empty accounts to account setup', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      </MemoryRouter>
    )

      await screen.findByRole('heading', { name: 'dashboard.title' })
    expect(screen.getByRole('link', { name: 'dashboard.quickActions.newExpense' })).toHaveAttribute('href', '/transactions?new=expense')
    expect(screen.getByRole('link', { name: 'dashboard.quickActions.newIncome' })).toHaveAttribute('href', '/transactions?new=income')
    expect(screen.getByRole('link', { name: 'transactions.reconciliation.title' })).toHaveAttribute('href', '/transactions?reconcile=1')
    expect(screen.getByRole('link', { name: 'reports.forecast.bpo.payables' })).toHaveAttribute('href', '/reports?tab=payables')
    const accountPanel = screen.getByRole('heading', { name: 'dashboard.myAccounts' }).parentElement.parentElement
    expect(await within(accountPanel).findByRole('link', { name: 'accounts.newAccount' })).toHaveAttribute('href', '/accounts')
    expect(within(accountPanel).getByText('common.noData')).toBeInTheDocument()
  })
})