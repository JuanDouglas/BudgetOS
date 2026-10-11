import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../lib/api'
import { useFormatters } from '../hooks/useFormatters'
import { formatLocalDate } from '../lib/utils'
import { PieChart, TrendingUp } from 'lucide-react'
import { FileText, ArrowDownToLine, ArrowUpFromLine, Download, Scale } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line
} from 'recharts'

const COLORS = ['#12284d', '#cca761', '#526989', '#dfc58d', '#233c63', '#b1904e', '#71809a', '#e9dcbd']

export default function Reports() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = ['dre', 'accounting', 'payables', 'forecast', 'trend', 'categories'].includes(requestedTab) ? requestedTab : 'dre'
  const [period, setPeriod] = useState(() => {
    const defaults = currentMonthPeriod()
    const requestedPeriod = {
      startDate: searchParams.get('startDate') || defaults.startDate,
      endDate: searchParams.get('endDate') || defaults.endDate,
    }
    return isValidPeriod(requestedPeriod) ? requestedPeriod : defaults
  })
  const periodIsValid = isValidPeriod(period)
  const quickPeriods = [
    { id: 'current-month', label: t('reports.periods.currentMonth', { defaultValue: 'Este mês' }), value: currentMonthPeriod() },
    { id: 'previous-month', label: t('reports.periods.previousMonth', { defaultValue: 'Mês anterior' }), value: previousMonthPeriod() },
    { id: 'current-quarter', label: t('reports.periods.currentQuarter', { defaultValue: 'Trimestre atual' }), value: currentQuarterPeriod() },
    { id: 'current-year', label: t('reports.periods.currentYear', { defaultValue: 'Ano atual' }), value: currentYearPeriod() },
  ]

  const handleTabChange = (tab) => {
    const nextParams = new URLSearchParams(searchParams)
    if (tab === 'dre') nextParams.delete('tab')
    else nextParams.set('tab', tab)
    setSearchParams(nextParams, { replace: true })
  }

  const handlePeriodChange = (nextPeriod) => {
    setPeriod(nextPeriod)
    const nextParams = new URLSearchParams(searchParams)
    if (isValidPeriod(nextPeriod)) {
      nextParams.set('startDate', nextPeriod.startDate)
      nextParams.set('endDate', nextPeriod.endDate)
    } else {
      nextParams.delete('startDate')
      nextParams.delete('endDate')
    }
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <p className="text-gray-600">{t('reports.subtitle')}</p>
      </div>

      {!['trend', 'forecast'].includes(activeTab) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="report-start-date" className="mb-1 block text-sm font-medium text-gray-700">{t('common.from', { defaultValue: 'De' })}</label>
              <input
                id="report-start-date"
                type="date"
                value={period.startDate}
                max={period.endDate || undefined}
                aria-invalid={!periodIsValid}
                onChange={(event) => handlePeriodChange({ ...period, startDate: event.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="report-end-date" className="mb-1 block text-sm font-medium text-gray-700">{t('common.to', { defaultValue: 'Até' })}</label>
              <input
                id="report-end-date"
                type="date"
                value={period.endDate}
                min={period.startDate || undefined}
                aria-invalid={!periodIsValid}
                onChange={(event) => handlePeriodChange({ ...period, endDate: event.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('reports.periods.quickSelect', { defaultValue: 'Períodos rápidos' })}>
            {quickPeriods.map((quickPeriod) => {
              const isSelected = period.startDate === quickPeriod.value.startDate && period.endDate === quickPeriod.value.endDate
              return (
                <button
                  key={quickPeriod.id}
                  type="button"
                  onClick={() => handlePeriodChange(quickPeriod.value)}
                  aria-pressed={isSelected}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${isSelected ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {quickPeriod.label}
                </button>
              )
            })}
          </div>
          {!periodIsValid && (
            <p role="status" className="text-sm text-amber-700">
              {t('reports.periods.invalid', { defaultValue: 'Informe as duas datas e confira se a data inicial não é posterior à data final.' })}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b">
        {[
          { id: 'dre', label: t('reports.forecast.bpo.dre', { defaultValue: 'DRE gerencial' }), icon: FileText },
          { id: 'accounting', label: t('reports.forecast.bpo.accounting', { defaultValue: 'Contábil' }), icon: Scale },
          { id: 'payables', label: t('reports.forecast.bpo.payables', { defaultValue: 'A pagar/receber' }), icon: ArrowDownToLine },
          { id: 'forecast', label: t('reports.forecast.bpo.cashflow', { defaultValue: 'Fluxo de caixa' }), icon: ArrowUpFromLine },
          { id: 'trend', label: t('reports.tabs.trend'), icon: TrendingUp },
          { id: 'categories', label: t('reports.tabs.categories'), icon: PieChart },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'trend' && <MonthlyTrend />}
      {activeTab === 'forecast' && <Forecast />}
      {!['trend', 'forecast'].includes(activeTab) && (periodIsValid ? (
        <>
          {activeTab === 'dre' && <IncomeStatement period={period} />}
          {activeTab === 'accounting' && <AccountingTrialBalance period={period} />}
          {activeTab === 'payables' && <PayablesReceivables period={period} />}
          {activeTab === 'categories' && <CategoryBreakdown period={period} />}
        </>
      ) : (
        <div className="card flex min-h-40 items-center justify-center text-center text-sm text-gray-600">
          {t('reports.periods.invalid', { defaultValue: 'Informe as duas datas e confira se a data inicial não é posterior à data final.' })}
        </div>
      ))}
    </div>
  )
}

function IncomeStatement({ period }) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useFormatters()
  const { data, isLoading, error } = useQuery({
    queryKey: ['bpo-income-statement', period.startDate, period.endDate],
    queryFn: async () => {
      const [incomeResponse, expenseResponse] = await Promise.all([
        reportsApi.getIncomeByCategory(period),
        reportsApi.getExpensesByCategory(period),
      ])
      return {
        income: incomeResponse.data.data.income || [],
        expenses: expenseResponse.data.data.expenses || [],
      }
    },
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const incomeTotal = data.income.reduce((total, item) => total + Number(item.total), 0)
  const expenseTotal = data.expenses.reduce((total, item) => total + Number(item.total), 0)
  const rows = [
    ...data.income.map((item) => ({ ...item, kind: 'income' })),
    ...data.expenses.map((item) => ({ ...item, kind: 'expense' })),
  ]

  return (
    <div className="card overflow-x-auto">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('reports.forecast.bpo.dreTitle', { defaultValue: 'DRE gerencial' })}</h3>
          <p className="text-sm text-gray-500">{formatDate(period.startDate)} - {formatDate(period.endDate)}</p>
        </div>
        <div className="flex items-end gap-5">
          <ExportButton headers={['Natureza', 'Categoria', 'Lançamentos', 'Valor']} rows={rows.map((item) => [item.kind === 'income' ? 'Receita' : 'Despesa', item.categoryName, item.count, item.total])} fileName="dre-gerencial.csv" />
          <div className="text-right">
          <p className="text-sm text-gray-500">{t('reports.forecast.bpo.netResult', { defaultValue: 'Resultado líquido' })}</p>
          <p className="text-xl font-bold">{formatCurrency(incomeTotal - expenseTotal)}</p>
          </div>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryValue label={t('reports.forecast.bpo.income', { defaultValue: 'Receitas' })} value={incomeTotal} formatCurrency={formatCurrency} />
        <SummaryValue label={t('reports.forecast.bpo.expenses', { defaultValue: 'Despesas' })} value={expenseTotal} formatCurrency={formatCurrency} />
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="py-2 font-medium">{t('reports.forecast.bpo.accountingGroup', { defaultValue: 'Grupo' })}</th>
            <th className="py-2 text-right font-medium">{t('reports.forecast.bpo.entries', { defaultValue: 'Lançamentos' })}</th>
            <th className="py-2 text-right font-medium">{t('reports.forecast.bpo.amount', { defaultValue: 'Valor' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item, index) => (
            <tr key={`${item.kind}-${item.categoryId || index}`}>
              <td className="py-2.5">{item.categoryName}</td>
              <td className="py-2.5 text-right text-gray-500">{item.count}</td>
              <td className="py-2.5 text-right font-medium">{formatCurrency(item.total)}</td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={3} label={t('reports.forecast.bpo.noEntries', { defaultValue: 'Sem lançamentos no período' })} />}
        </tbody>
      </table>
    </div>
  )
}

function AccountingTrialBalance({ period }) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useFormatters()
  const { data, isLoading, error } = useQuery({
    queryKey: ['bpo-accounting-trial-balance', period.startDate, period.endDate],
    queryFn: async () => {
      const [incomeResponse, expenseResponse] = await Promise.all([
        reportsApi.getIncomeByCategory(period),
        reportsApi.getExpensesByCategory(period),
      ])
      return [
        ...(incomeResponse.data.data.income || []).map((item) => ({ ...item, nature: 'Crédito', kind: 'Receita' })),
        ...(expenseResponse.data.data.expenses || []).map((item) => ({ ...item, nature: 'Débito', kind: 'Despesa' })),
      ]
    },
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const credits = data.filter((row) => row.nature === 'Crédito').reduce((sum, row) => sum + Number(row.total), 0)
  const debits = data.filter((row) => row.nature === 'Débito').reduce((sum, row) => sum + Number(row.total), 0)

  return (
    <div className="card overflow-x-auto">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('reports.forecast.bpo.accountingTitle', { defaultValue: 'Balancete gerencial' })}</h3>
          <p className="text-sm text-gray-500">{formatDate(period.startDate)} - {formatDate(period.endDate)}</p>
        </div>
        <ExportButton headers={['Grupo', 'Natureza', 'Categoria', 'Lançamentos', 'Valor']} rows={data.map((row) => [row.kind, row.nature, row.categoryName, row.count, row.total])} fileName="balancete-gerencial.csv" />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryValue label={t('reports.forecast.bpo.credit', { defaultValue: 'Créditos' })} value={credits} formatCurrency={formatCurrency} />
        <SummaryValue label={t('reports.forecast.bpo.debit', { defaultValue: 'Débitos' })} value={debits} formatCurrency={formatCurrency} />
        <SummaryValue label={t('reports.forecast.bpo.balance', { defaultValue: 'Saldo do período' })} value={credits - debits} formatCurrency={formatCurrency} />
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="py-2 font-medium">{t('reports.forecast.bpo.accountingGroup', { defaultValue: 'Categoria' })}</th>
            <th className="py-2 font-medium">{t('reports.forecast.bpo.nature', { defaultValue: 'Natureza' })}</th>
            <th className="py-2 text-right font-medium">{t('reports.forecast.bpo.entries', { defaultValue: 'Lançamentos' })}</th>
            <th className="py-2 text-right font-medium">{t('reports.forecast.bpo.amount', { defaultValue: 'Valor' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row, index) => (
            <tr key={`${row.kind}-${row.categoryId || index}`}>
              <td className="py-2.5">{row.categoryName}</td>
              <td className="py-2.5">{t(`reports.forecast.bpo.${row.nature.toLowerCase()}`, { defaultValue: row.nature })}</td>
              <td className="py-2.5 text-right text-gray-500">{row.count}</td>
              <td className="py-2.5 text-right font-medium">{formatCurrency(row.total)}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={4} label={t('reports.forecast.bpo.noEntries', { defaultValue: 'Sem lançamentos no período' })} />}
        </tbody>
      </table>
    </div>
  )
}

function PayablesReceivables({ period }) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useFormatters()
  const { startDate, endDate } = period
  const { data, isLoading, error } = useQuery({
    queryKey: ['bpo-payables-receivables', startDate, endDate],
    queryFn: () => reportsApi.getForecastTransactions({ startDate, endDate, limit: 500 })
      .then((response) => response.data.data.data || []),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const pending = data.filter((item) => item.source === 'projected' || item.status === 'pending')
  const payables = pending.filter((item) => item.type === 'expense')
  const receivables = pending.filter((item) => item.type === 'income')

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">{t('reports.forecast.bpo.dueWindow', { defaultValue: 'Vencimentos previstos para os próximos 90 dias' })}</p>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TransactionList title={t('reports.forecast.bpo.payables', { defaultValue: 'Contas a pagar' })} transactions={payables} formatCurrency={formatCurrency} formatDate={formatDate} exportFileName="contas-a-pagar.csv" />
        <TransactionList title={t('reports.forecast.bpo.receivables', { defaultValue: 'Contas a receber' })} transactions={receivables} formatCurrency={formatCurrency} formatDate={formatDate} exportFileName="contas-a-receber.csv" />
      </div>
    </div>
  )
}

function TransactionList({ title, transactions, formatCurrency, formatDate, exportFileName }) {
  const { t } = useTranslation()

  return (
    <div className="card overflow-x-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <ExportButton headers={['Data', 'Descrição', 'Conta/Categoria', 'Valor', 'Status']} rows={transactions.map((item) => [item.date, item.description, item.payeeName || item.accountName || item.categoryName || '', item.amount, item.status])} fileName={exportFileName} />
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="py-2 font-medium">{t('reports.forecast.bpo.dueDate', { defaultValue: 'Data' })}</th>
            <th className="py-2 font-medium">{t('reports.forecast.bpo.description', { defaultValue: 'Descrição' })}</th>
            <th className="py-2 text-right font-medium">{t('reports.forecast.bpo.amount', { defaultValue: 'Valor' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map((item) => (
            <tr key={item.id}>
              <td className="whitespace-nowrap py-2.5">{formatDate(item.date)}</td>
              <td className="py-2.5">
                <p className="font-medium">{item.description}</p>
                <p className="text-xs text-gray-500">{item.payeeName || item.accountName || item.categoryName || ''}</p>
              </td>
              <td className="whitespace-nowrap py-2.5 text-right font-medium">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
          {transactions.length === 0 && <EmptyRow colSpan={3} label={t('reports.forecast.bpo.noEntries', { defaultValue: 'Sem lançamentos' })} />}
        </tbody>
      </table>
    </div>
  )
}

function SummaryValue({ label, value, formatCurrency }) {
  return (
    <div className="rounded-md bg-gray-50 px-4 py-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{formatCurrency(value)}</p>
    </div>
  )
}

function EmptyRow({ colSpan, label }) {
  return <tr><td colSpan={colSpan} className="py-8 text-center text-gray-500">{label}</td></tr>
}

function ExportButton({ headers, rows, fileName }) {
  const { t } = useTranslation()

  const download = () => {
    const escapeCsv = (value) => {
      const normalized = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : String(value ?? '')
      return `"${normalized.replace(/"/g, '""')}"`
    }
    const content = [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n')
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <button type="button" onClick={download} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" title={t('common.export')}>
      <Download className="h-4 w-4" />
      <span>{t('common.export')}</span>
    </button>
  )
}

function currentMonthPeriod() {
  const now = new Date()
  return monthPeriod(now.getFullYear(), now.getMonth())
}

function previousMonthPeriod() {
  const now = new Date()
  return monthPeriod(now.getFullYear(), now.getMonth() - 1)
}

function currentQuarterPeriod() {
  const now = new Date()
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
  return {
    startDate: formatLocalDate(new Date(now.getFullYear(), quarterStartMonth, 1)),
    endDate: formatLocalDate(now),
  }
}

function currentYearPeriod() {
  const now = new Date()
  return {
    startDate: formatLocalDate(new Date(now.getFullYear(), 0, 1)),
    endDate: formatLocalDate(now),
  }
}

function monthPeriod(year, month) {
  return {
    startDate: formatLocalDate(new Date(year, month, 1)),
    endDate: formatLocalDate(new Date(year, month + 1, 0)),
  }
}

function isValidPeriod(period) {
  return isValidDate(period.startDate) && isValidDate(period.endDate) && period.startDate <= period.endDate
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function MonthlyTrend() {
  const { t } = useTranslation()
  const { formatCurrency } = useFormatters()
  const { data, isLoading, error } = useQuery({
    queryKey: ['monthly-trend'],
    queryFn: () => reportsApi.getMonthlyTrend({ months: 12 }).then(r => r.data.data.trend),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  return (
    <div className="card">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{t('reports.trend.title')}</h3>
        <ExportButton headers={['Mês', 'Receitas', 'Despesas', 'Resultado']} rows={(data || []).map((row) => [row.monthLabel, row.income, row.expenses, row.netFlow])} fileName="tendencia-mensal.csv" />
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v/1000}k`} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ borderRadius: '8px' }}
            />
            <Bar dataKey="income" name={t('reports.trend.income')} fill="#12284d" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name={t('reports.trend.expenses')} fill="#cca761" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CategoryBreakdown({ period }) {
  const { t } = useTranslation()
  const { formatCurrency } = useFormatters()
  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses-category-report', period.startDate, period.endDate],
    queryFn: () => reportsApi.getExpensesByCategory(period).then(r => r.data.data.expenses),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const pieData = data?.slice(0, 8).map((e, i) => ({
    name: e.categoryName,
    value: e.total,
    color: e.color || COLORS[i % COLORS.length],
  })) || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-6">{t('reports.categoryBreakdown.title')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </RechartsPie>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{t('reports.categoryBreakdown.detail')}</h3>
          <ExportButton headers={['Categoria', 'Lançamentos', 'Percentual', 'Valor']} rows={(data || []).map((row) => [row.categoryName, row.count, row.percentage, row.total])} fileName="despesas-por-categoria.csv" />
        </div>
        <div className="space-y-4">
          {data?.slice(0, 8).map((cat, i) => (
            <div key={cat.categoryId || i} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color || COLORS[i % COLORS.length] }}
              />
              <span className="flex-1 text-gray-700 truncate">{cat.categoryName}</span>
              <span className="text-sm text-gray-500">{cat.percentage}%</span>
              <span className="font-semibold">{formatCurrency(cat.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Forecast() {
  const { t } = useTranslation()
  const { formatCurrency, locale } = useFormatters()
  const { data, isLoading, error } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => reportsApi.getForecast({ days: 90 }).then(r => r.data.data.forecast),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const chartData = data?.dailyBalances?.filter((_, i) => i % 7 === 0) || []
  const intlLocale = locale === 'pt' ? 'pt-BR' : locale

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">{t('reports.forecast.currentBalance')}</p>
          <p className="text-2xl font-bold">{formatCurrency(data?.currentBalance || 0)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">{t('reports.forecast.in30days')}</p>
          <p className="text-2xl font-bold">{formatCurrency(data?.forecast?.days30 || 0)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">{t('reports.forecast.in60days')}</p>
          <p className="text-2xl font-bold">{formatCurrency(data?.forecast?.days60 || 0)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">{t('reports.forecast.in90days')}</p>
          <p className="text-2xl font-bold">{formatCurrency(data?.forecast?.days90 || 0)}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{t('reports.forecast.title')}</h3>
          <ExportButton headers={['Data', 'Saldo']} rows={(data?.dailyBalances || []).map((row) => [row.date, row.balance])} fileName="fluxo-de-caixa.csv" />
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short' }).format(new Date(v))}
              />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => new Intl.DateTimeFormat(intlLocale).format(new Date(label))}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#12284d"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="card flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  )
}

function ErrorState({ error }) {
  const { t } = useTranslation()
  return (
    <div className="card flex items-center justify-center h-64 text-red-600">
      {t('common.error')}: {error?.message}
    </div>
  )
}
