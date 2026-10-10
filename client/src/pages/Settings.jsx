import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useMutation } from '@tanstack/react-query'
import { translateError } from '../lib/errorHelper'
import { formatNumber } from '../hooks/useFormatters'
import { User, Lock, Palette, Save } from 'lucide-react'
import { useToast } from '../components/Toast'
import PasswordInput from '../components/PasswordInput'
import FormLanguageSelect from '../components/FormLanguageSelect'
import ToggleSwitch from '../components/ToggleSwitch'
import api from '../lib/api'

export default function Settings() {
  const { t } = useTranslation()
  const { user, checkAuth } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'security', label: t('settings.tabs.security'), icon: Lock },
    { id: 'preferences', label: t('settings.tabs.preferences'), icon: Palette },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-gray-600">{t('settings.subtitle')}</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <ProfileSettings user={user} checkAuth={checkAuth} />
          )}
          {activeTab === 'security' && (
            <SecuritySettings />
          )}
          {activeTab === 'preferences' && (
            <PreferencesSettings user={user} checkAuth={checkAuth} />
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileSettings({ user, checkAuth }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  })

  const mutation = useMutation({
    mutationFn: (data) => api.put('/auth/profile', data),
    onSuccess: () => {
      toast.success(t('settings.profile.saved'))
      checkAuth()
    },
    onError: (err) => toast.error(translateError(err)),
  })

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">{t('settings.profile.title')}</h2>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.profile.email')}</label>
          <input type="email" value={user?.email || ''} disabled className="input bg-gray-50" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.profile.firstName')}</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.profile.lastName')}</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="input"
            />
          </div>
        </div>
        <button type="submit" disabled={mutation.isPending} className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {t('common.save')}
        </button>
      </form>
    </div>
  )
}

function SecuritySettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const mutation = useMutation({
    mutationFn: (data) => api.put('/auth/password', data),
    onSuccess: () => {
      toast.success(t('settings.security.saved'))
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (err) => toast.error(translateError(err)),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t('settings.security.passwordMismatch'))
      return
    }
    mutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
      newPasswordConfirm: formData.confirmPassword,
    })
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">{t('settings.security.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.security.currentPassword')}</label>
          <PasswordInput
            value={formData.currentPassword}
            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.security.newPassword')}</label>
          <PasswordInput
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            className="input"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.security.confirmPassword')}</label>
          <PasswordInput
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="input"
            required
          />
        </div>
        <button type="submit" disabled={mutation.isPending} className="btn btn-primary flex items-center gap-2">
          <Lock className="w-4 h-4" />
          {t('settings.security.submit')}
        </button>
      </form>
    </div>
  )
}

function PreferencesSettings({ user, checkAuth }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { userSettings, updateSettings } = useAuth()
  const [formData, setFormData] = useState({
    locale: user?.locale || 'pt',
    currency: user?.currency || 'BRL',
    decimalSeparator: user?.decimalSeparator || ',',
    digitGrouping: user?.digitGrouping ?? '.',
  })
  const [settingsData, setSettingsData] = useState({
    weekStartDay: userSettings?.weekStartDay ?? 1,
    modalPersistent: userSettings?.modalPersistent ?? false,
    projectionExpanded: userSettings?.projectionExpanded ?? false,
  })

  const profileMutation = useMutation({
    mutationFn: (data) => api.put('/auth/profile', data),
    onSuccess: () => {
      checkAuth()
    },
    onError: (err) => toast.error(translateError(err)),
  })

  const settingsMutation = useMutation({
    mutationFn: async (data) => updateSettings(data),
    onError: (err) => toast.error(translateError(err)),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.digitGrouping && formData.digitGrouping === formData.decimalSeparator) {
      toast.error(t('settings.preferences.sameSeparatorError'))
      return
    }
    try {
      await profileMutation.mutateAsync(formData)
      await settingsMutation.mutateAsync(settingsData)
      toast.success(t('settings.preferences.saved'))
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">{t('settings.preferences.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.preferences.language')}</label>
          <FormLanguageSelect
            value={formData.locale}
            onChange={(locale) => setFormData({
              ...formData,
              locale,
              ...(locale === 'pt' ? { currency: 'BRL', decimalSeparator: ',', digitGrouping: '.' } : {}),
            })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.preferences.currency')}</label>
          <select
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="input"
          >
            <option value="BRL">{t('settings.preferences.currencies.BRL')}</option>
            <option value="EUR">{t('settings.preferences.currencies.EUR')}</option>
            <option value="USD">{t('settings.preferences.currencies.USD')}</option>
            <option value="GBP">{t('settings.preferences.currencies.GBP')}</option>
            <option value="CHF">{t('settings.preferences.currencies.CHF')}</option>
            <option value="CAD">{t('settings.preferences.currencies.CAD')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.preferences.weekStartDay')}</label>
          <select
            value={settingsData.weekStartDay}
            onChange={(e) => setSettingsData({ ...settingsData, weekStartDay: parseInt(e.target.value) })}
            className="input"
          >
            <option value={1}>{t('settings.preferences.weekDays.monday')}</option>
            <option value={0}>{t('settings.preferences.weekDays.sunday')}</option>
            <option value={6}>{t('settings.preferences.weekDays.saturday')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.preferences.decimalSeparator')}</label>
          <select
            value={formData.decimalSeparator}
            onChange={(e) => setFormData({ ...formData, decimalSeparator: e.target.value })}
            className="input"
          >
            <option value=",">{t('settings.preferences.decimalSeparators.comma')}</option>
            <option value=".">{t('settings.preferences.decimalSeparators.dot')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.preferences.digitGrouping')}</label>
          <select
            value={formData.digitGrouping}
            onChange={(e) => setFormData({ ...formData, digitGrouping: e.target.value })}
            className="input"
          >
            <option value=" ">{t('settings.preferences.digitGroupings.space')}</option>
            <option value=",">{t('settings.preferences.digitGroupings.comma')}</option>
            <option value=".">{t('settings.preferences.digitGroupings.dot')}</option>
            <option value="">{t('settings.preferences.digitGroupings.none')}</option>
          </select>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            {t('settings.preferences.preview', { value: formatNumber(1234567.89, formData.decimalSeparator, formData.digitGrouping) })}
          </p>
        </div>

        {/* Interface section */}
        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">{t('settings.preferences.interface')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{t('settings.preferences.modalPersistent')}</p>
                <p className="text-xs text-gray-500">{t('settings.preferences.modalPersistentDesc')}</p>
              </div>
              <ToggleSwitch
                checked={settingsData.modalPersistent}
                onChange={() => setSettingsData({ ...settingsData, modalPersistent: !settingsData.modalPersistent })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{t('settings.preferences.projectionExpanded')}</p>
                <p className="text-xs text-gray-500">{t('settings.preferences.projectionExpandedDesc')}</p>
              </div>
              <ToggleSwitch
                checked={settingsData.projectionExpanded}
                onChange={() => setSettingsData({ ...settingsData, projectionExpanded: !settingsData.projectionExpanded })}
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={profileMutation.isPending || settingsMutation.isPending} className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {t('common.save')}
        </button>
      </form>
    </div>
  )
}
