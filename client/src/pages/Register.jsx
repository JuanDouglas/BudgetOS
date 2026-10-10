import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../lib/brand'
import { useAuth } from '../contexts/AuthContext'
import { UserPlus, Mail, Lock, User } from 'lucide-react'
import PasswordInput from '../components/PasswordInput'
import { preloadCsrfToken } from '../lib/api'
import { translateError } from '../lib/errorHelper'
import { useToast } from '../components/Toast'
import LanguageSelector from '../components/LanguageSelector'

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    firstName: '',
    lastName: '',
    locale: 'pt',
    currency: 'BRL',
  })
  const [loading, setLoading] = useState(false)
  const { register, needsSetup } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useTranslation()

  // Preload the CSRF token on component mount
  useEffect(() => {
    preloadCsrfToken()
  }, [])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.passwordConfirm) {
      toast.error(t('auth.register.passwordMismatch'))
      return
    }

    setLoading(true)

    try {
      await register(formData)
      navigate('/')
    } catch (err) {
      toast.error(translateError(err) || t('auth.register.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4 relative">
      <LanguageSelector />
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
              <span className="text-2xl font-bold text-primary-600">{BRAND.mark}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {needsSetup ? t('auth.register.welcomeTitle').replace('BudgetOS', BRAND.name) : t('auth.register.createTitle')}
            </h1>
            <p className="text-gray-600 mt-2">
              {needsSetup ? t('auth.register.welcomeSubtitle') : t('auth.register.createSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.register.firstName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="input pl-10"
                    placeholder={t('auth.register.firstNamePlaceholder')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.register.lastName')}</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input"
                  placeholder={t('auth.register.lastNamePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.register.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder={t('auth.register.emailPlaceholder')}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.register.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <PasswordInput
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder={t('auth.register.passwordPlaceholder')}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.register.confirm')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <PasswordInput
                  name="passwordConfirm"
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder={t('auth.register.confirmPlaceholder')}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  {t('auth.register.submit')}
                </>
              )}
            </button>
          </form>

          {!needsSetup && (
            <p className="mt-6 text-center text-sm text-gray-600">
              {t('auth.register.hasAccount')}{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                {t('auth.register.login')}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
