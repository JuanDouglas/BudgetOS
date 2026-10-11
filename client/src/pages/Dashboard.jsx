import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { reportsApi, accountsApi } from '../lib/api'
import { useFormatters } from '../hooks/useFormatters'
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownRight, Clock, PieChart, ExternalLink, Plus, Upload, Scale, FileText, CalendarClock
} from 'lucide-react'
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function StatCard({ title, value, icon: Icon, trend, color = 'primary', t }) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {t('common.vsLastMonth', { value: Math.abs(trend).toFixed(1) })}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

function RecentTransactions({ transactions, t, formatCurrency, formatDateRelative }) {
  if (!transactions?.length) {
    return <p className="text-gray-500 text-center py-8">{t('dashboard.noTransactions')}</p>
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
          <div className={`p-2 rounded-full ${tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            {tx.amount >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{tx.description}</p>
            <p className="text-sm text-gray-500">{tx.categoryName || t('dashboard.uncategorized')}</p>
          </div>
          <div className="text-right">
            <p className={`font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
            </p>
            <p className="text-xs text-gray-500">{formatDateRelative(tx.date)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { formatCurrency, formatDateRelative } = useFormatters()

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.getDashboard().then(r => r.data.data),
  })

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then(r => r.data),
  })

  const { data: expenses } = useQuery({
    queryKey: ['expenses-category'],
    queryFn: () => reportsApi.getExpensesByCategory({}).then(r => r.data.data.expenses),
  })

  const { data: projections } = useQuery({
    queryKey: ['projections'],
    queryFn: () => reportsApi.getProjections().then(r => r.data.data),
  })

  const pieData = useMemo(() => expenses?.slice(0, 6).map((e, i) => ({
    name: e.categoryName,
    value: e.total,
    color: e.color || COLORS[i % COLORS.length],
  })) || [], [expenses])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        {t('common.error')}: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="text-gray-600">{t('dashboard.subtitle')}</p>
      </div>

      <section aria-labelledby="dashboard-actions-title" className="space-y-3">
        <h2 id="dashboard-actions-title" className="text-sm font-semibold text-gray-700">{t('common.actions')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <Link to="/transactions?new=expense" className="flex min-h-14 items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
            <Plus className="h-4 w-4 shrink-0" />
            <span>{t('dashboard.quickActions.newExpense', { defaultValue: 'Nova despesa' })}</span>
          </Link>
          <Link to="/transactions?new=income" className="flex min-h-14 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span>{t('dashboard.quickActions.newIncome', { defaultValue: 'Nova receita' })}</span>
          </Link>
          <Link to="/import" className="flex min-h-14 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
            <Upload className="h-4 w-4 shrink-0" />
            <span>{t('import.title')}</span>
          </Link>
          <Link to="/transactions?reconcile=1" className="flex min-h-14 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
            <Scale className="h-4 w-4 shrink-0" />
            <span>{t('transactions.reconciliation.title')}</span>
          </Link>
          <Link to="/reports?tab=payables" className="flex min-h-14 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>{t('reports.forecast.bpo.payables', { defaultValue: 'A pagar/receber' })}</span>
          </Link>
          <Link to="/reports" className="flex min-h-14 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{t('reports.title')}</span>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={t('dashboard.totalBalance')}
          value={formatCurrency(dashboard?.totalBalance || 0)}
          icon={Wallet}
          color="primary"
          t={t}
        />
        <StatCard
          title={t('dashboard.monthlyIncome')}
          value={formatCurrency(dashboard?.monthlyIncome || 0)}
          icon={TrendingUp}
          color="green"
          t={t}
        />
        <StatCard
          title={t('dashboard.monthlyExpenses')}
          value={formatCurrency(dashboard?.monthlyExpenses || 0)}
          icon={TrendingDown}
          color="red"
          t={t}
        />
        <StatCard
          title={t('dashboard.netFlow')}
          value={formatCurrency(dashboard?.monthlyNetFlow || 0)}
          icon={Clock}
          color={dashboard?.monthlyNetFlow >= 0 ? 'green' : 'red'}
          t={t}
        />
        {projections?.totals && (
          <StatCard
            title={t('dashboard.projectionEndMonth')}
            value={formatCurrency(projections.totals.endOfMonth.estimatedBalance)}
            icon={TrendingUp}
            color={projections.totals.endOfMonth.delta >= 0 ? 'green' : 'red'}
            t={t}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.myAccounts')}</h2>
            <Link to="/accounts" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              {t('dashboard.viewAll')}
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          {accountsLoading ? (
            <p className="py-4 text-sm text-gray-500">{t('common.loading')}</p>
          ) : accountsError ? (
            <p role="alert" className="py-4 text-sm text-red-600">{t('common.error')}</p>
          ) : accounts?.data?.length ? (
            <div className="space-y-3">
              {accounts.data.map((account) => (
              <Link
                key={account.id}
                to={`/transactions?account=${account.id}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: account.color + '20', color: account.color }}
                >
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <p className="text-xs text-gray-500">{account.institution}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${account.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatCurrency(account.currentBalance)}
                  </p>
                  {(() => {
                    const proj = projections?.accounts?.find(p => p.accountId === account.id)
                    if (!proj || proj.endOfMonth.delta === 0) return null
                    return (
                      <p className="text-xs text-gray-400">
                        {t('accounts.projection.estimated')} {formatCurrency(proj.endOfMonth.estimatedBalance)}
                      </p>
                    )
                  })()}
                </div>
              </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-gray-50 px-4 py-5 text-center">
              <p className="mb-3 text-sm text-gray-600">{t('common.noData')}</p>
              <Link to="/accounts" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800">
                <Plus className="h-4 w-4" />
                {t('accounts.newAccount')}
              </Link>
            </div>
          )}
        </div>

        {/* Expenses by category */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            {t('dashboard.expensesByCategory')}
          </h2>
          {pieData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
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
          ) : (
            <p className="text-gray-500 text-center py-8">{t('common.noData')}</p>
          )}
          <div className="mt-4 space-y-2">
            {pieData.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-gray-600 truncate">{item.name}</span>
                <span className="font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.recentTransactions')}</h2>
          <RecentTransactions transactions={dashboard?.recentTransactions} t={t} formatCurrency={formatCurrency} formatDateRelative={formatDateRelative} />
        </div>
      </div>
    </div>
  )
}
