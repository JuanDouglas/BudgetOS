import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Reports from '../../src/pages/Reports'
import { formatLocalDate } from '../../src/lib/utils'

vi.mock('../../src/lib/api', () => ({
  reportsApi: {
    getIncomeByCategory: vi.fn().mockResolvedValue({ data: { data: { income: [] } } }),
    getExpensesByCategory: vi.fn().mockResolvedValue({ data: { data: { expenses: [] } } }),
    getForecastTransactions: vi.fn().mockResolvedValue({ data: { data: { data: [] } } }),
    getForecast: vi.fn().mockResolvedValue({
      data: {
        data: {
          forecast: {
            currentBalance: 1000,
            dailyBalances: [],
          },
        },
      },
    }),
  },
}))

vi.mock('../../src/hooks/useFormatters', () => ({
  useFormatters: () => ({
    formatCurrency: (value) => String(value),
    formatDate: (value) => value,
    locale: 'pt',
  }),
}))

const { reportsApi } = await import('../../src/lib/api')

function LocationDisplay() {
  const location = useLocation()
  return <span data-testid="report-location">{location.search}</span>
}

function renderReports(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <Reports />
        <LocationDisplay />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Reports period filter', () => {
  beforeEach(() => {
    const today = formatLocalDate(new Date())
    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback
      }
      observe() {
        this.callback([{ contentRect: { width: 800, height: 400 } }])
      }
      unobserve() {}
      disconnect() {}
    }
    vi.clearAllMocks()
    reportsApi.getIncomeByCategory.mockResolvedValue({ data: { data: { income: [] } } })
    reportsApi.getExpensesByCategory.mockResolvedValue({ data: { data: { expenses: [] } } })
    reportsApi.getForecastTransactions.mockResolvedValue({ data: { data: { data: [] } } })
    reportsApi.getForecast.mockResolvedValue({
      data: { data: { forecast: { currentBalance: 1000, dailyBalances: [{ date: today, balance: 1000 }] } } },
    })
  })

  it('shows guidance instead of breaking when the end date is temporarily empty', async () => {
    renderReports()
    const endDateInput = screen.getByLabelText('common.to')

    fireEvent.change(endDateInput, { target: { value: '' } })

    expect(screen.getByRole('status')).toHaveTextContent('reports.periods.invalid')
    expect(screen.getByLabelText('common.to')).toBeInTheDocument()
    expect(screen.queryByText('reports.forecast.bpo.dreTitle')).not.toBeInTheDocument()
  })

  it('reloads the report for a valid selected date range', async () => {
    renderReports()
    const startDate = screen.getByLabelText('common.from').value
    fireEvent.change(screen.getByLabelText('common.to'), { target: { value: startDate } })

    await waitFor(() => {
      expect(reportsApi.getIncomeByCategory).toHaveBeenLastCalledWith({
        startDate,
        endDate: startDate,
      })
    })
    expect(screen.getByTestId('report-location')).toHaveTextContent(`startDate=${startDate}&endDate=${startDate}`)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('opens the payables and receivables report from a deep link', async () => {
    renderReports('/reports?tab=payables')

    expect(await screen.findByText('reports.forecast.bpo.dueWindow')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'reports.forecast.bpo.payables' })).toBeInTheDocument()
  })

  it('restores a saved period from the URL', () => {
    renderReports('/reports?startDate=2026-07-01&endDate=2026-07-31')

    expect(screen.getByLabelText('common.from')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('common.to')).toHaveValue('2026-07-31')
  })

  it('shows realized and projected activity in the detailed cashflow', async () => {
    const today = formatLocalDate(new Date())
    reportsApi.getForecastTransactions.mockResolvedValue({
      data: {
        data: {
          data: [
            { id: 'actual-income', date: today, type: 'income', amount: 500, source: 'actual', description: 'Recebimento cliente', accountName: 'Conta corrente', categoryName: 'Serviços' },
            { id: 'projected-expense', date: today, type: 'expense', amount: -200, source: 'projected', description: 'Aluguel do escritório', accountName: 'Conta corrente', categoryName: 'Ocupação' },
          ],
        },
      },
    })
    renderReports()
    fireEvent.click(screen.getByRole('button', { name: 'reports.forecast.bpo.cashflow' }))

    fireEvent.click(await screen.findByText('reports.forecast.transactionCount'))
    expect(await screen.findByText('Recebimento cliente')).toBeInTheDocument()
    expect(screen.getByText('Aluguel do escritório')).toBeInTheDocument()
    expect(screen.getAllByText('reports.forecast.actualIncome')).toHaveLength(2)
    expect(reportsApi.getForecast).toHaveBeenCalledWith({ days: 90 })
  })
})