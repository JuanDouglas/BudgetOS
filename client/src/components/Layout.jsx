import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, Wallet, ArrowLeftRight, CreditCard,
  Tags, BarChart3, LogOut, Menu, X, Upload, Repeat,
  Wand2, Settings, Users, Shield, FolderTree, Cog, CalendarRange, Building2, Plus
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'
import { BRAND } from '../lib/brand'

const navigation = [
  { name: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { name: 'nav.accounts', href: '/accounts', icon: Wallet },
  { name: 'nav.transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'nav.forecast', href: '/forecast', icon: CalendarRange },
  { name: 'nav.recurring', href: '/planned', icon: Repeat },
  { name: 'nav.creditCards', href: '/credit-cards', icon: CreditCard },
  { name: 'nav.categories', href: '/categories', icon: Tags },
  { name: 'nav.payees', href: '/payees', icon: Users },
  { name: 'nav.import', href: '/import', icon: Upload },
  { name: 'nav.rules', href: '/rules', icon: Wand2 },
  { name: 'nav.reports', href: '/reports', icon: BarChart3 },
  { name: 'nav.settings', href: '/settings', icon: Settings },
]

const adminNavigation = [
  { name: 'admin.users.title', href: '/admin/users', icon: Users },
  { name: 'admin.groups.title', href: '/admin/groups', icon: FolderTree },
  { name: 'admin.settings.title', href: '/admin/settings', icon: Cog },
]

export default function Layout() {
  const { user, isGroupAdmin, logout, workspaces, activeWorkspace, switchWorkspace, createWorkspace } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', locale: 'pt', currency: 'BRL' })
  const [workspaceError, setWorkspaceError] = useState('')
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleWorkspaceChange = async (event) => {
    setWorkspaceError('')
    setSwitchingWorkspace(true)
    try {
      await switchWorkspace(event.target.value)
      queryClient.clear()
    } catch (error) {
      setWorkspaceError(error.response?.data?.error?.message || t('common.error'))
    } finally {
      setSwitchingWorkspace(false)
    }
  }

  const handleCreateWorkspace = async (event) => {
    event.preventDefault()
    setWorkspaceError('')
    setCreatingWorkspace(true)
    try {
      await createWorkspace(newClient)
      queryClient.clear()
      setShowNewClient(false)
      setNewClient({ name: '', locale: 'pt', currency: 'BRL' })
    } catch (error) {
      setWorkspaceError(error.response?.data?.error?.message || t('common.error'))
    } finally {
      setCreatingWorkspace(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">{BRAND.name}</h1>
            <button 
              className="lg:hidden p-1 rounded hover:bg-gray-100"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {t(item.name)}
              </NavLink>
            ))}

            {/* Admin section - super_admin and group admins */}
            {(user?.role === 'super_admin' || isGroupAdmin) && (
              <>
                <div className="border-t border-gray-200 my-3" />
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  {t('nav.administration')}
                </p>
                {adminNavigation
                  .filter((item) => {
                    // Group admins only see Groups link
                    if (user?.role === 'super_admin') return true
                    return item.href === '/admin/groups'
                  })
                  .map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    {t(item.name)}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          {/* Version */}
          <div className="mx-4 mb-2 px-3 py-1.5 bg-gray-50 rounded-lg text-center">
            <span className="text-xs text-gray-400 font-medium tracking-wide">{BRAND.name} v{__APP_VERSION__}</span>
          </div>

          {/* User */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.fullName || user?.email}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title={t('nav.logout')}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center h-16 px-4 gap-4">
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Building2 className="hidden h-4 w-4 shrink-0 text-gray-500 sm:block" />
              <label htmlFor="active-workspace" className="sr-only">{t('workspaces.current', { defaultValue: 'Cliente atual' })}</label>
              <select
                id="active-workspace"
                value={activeWorkspace?.id || ''}
                onChange={handleWorkspaceChange}
                disabled={switchingWorkspace}
                className="input h-10 max-w-[min(52vw,240px)] py-1 text-sm"
                aria-label={t('workspaces.current', { defaultValue: 'Cliente atual' })}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.isPersonal ? t('workspaces.personal', { defaultValue: 'Meu espaço' }) : workspace.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                title={t('workspaces.add', { defaultValue: 'Adicionar cliente' })}
                aria-label={t('workspaces.add', { defaultValue: 'Adicionar cliente' })}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {workspaceError && !showNewClient && <p role="alert" className="mb-4 text-sm text-red-600">{workspaceError}</p>}
          <Outlet />
        </main>
      </div>

      {showNewClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowNewClient(false)
        }}>
          <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="new-client-title">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="new-client-title" className="text-lg font-semibold">{t('workspaces.newTitle', { defaultValue: 'Novo cliente' })}</h2>
              <button type="button" onClick={() => setShowNewClient(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label={t('common.close', { defaultValue: 'Fechar' })}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label htmlFor="client-name" className="mb-1 block text-sm font-medium text-gray-700">{t('workspaces.name', { defaultValue: 'Nome do cliente' })}</label>
                <input id="client-name" autoFocus required maxLength={120} value={newClient.name} onChange={(event) => setNewClient({ ...newClient, name: event.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-locale" className="mb-1 block text-sm font-medium text-gray-700">{t('settings.preferences.language', { defaultValue: 'Idioma' })}</label>
                  <select id="client-locale" value={newClient.locale} onChange={(event) => setNewClient({ ...newClient, locale: event.target.value, currency: event.target.value === 'pt' ? 'BRL' : newClient.currency })} className="input">
                    <option value="pt">Português (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="client-currency" className="mb-1 block text-sm font-medium text-gray-700">{t('settings.preferences.currency', { defaultValue: 'Moeda' })}</label>
                  <select id="client-currency" value={newClient.currency} onChange={(event) => setNewClient({ ...newClient, currency: event.target.value })} className="input">
                    <option value="BRL">BRL - Real brasileiro</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - Dólar americano</option>
                    <option value="GBP">GBP - Libra esterlina</option>
                    <option value="CAD">CAD - Dólar canadense</option>
                    <option value="CHF">CHF - Franco suíço</option>
                  </select>
                </div>
              </div>
              {workspaceError && <p role="alert" className="text-sm text-red-600">{workspaceError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewClient(false)} className="btn btn-secondary">{t('common.cancel', { defaultValue: 'Cancelar' })}</button>
                <button type="submit" disabled={creatingWorkspace} className="btn btn-primary disabled:opacity-60">
                  {creatingWorkspace ? t('common.saving', { defaultValue: 'Salvando...' }) : t('workspaces.create', { defaultValue: 'Criar cliente' })}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
