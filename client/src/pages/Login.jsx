import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../lib/brand'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react'
import PasswordInput from '../components/PasswordInput'
import { preloadCsrfToken } from '../lib/api'
import { translateError } from '../lib/errorHelper'
import LanguageSelector from '../components/LanguageSelector'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Always refresh the CSRF token before login
      await preloadCsrfToken()
      await login(email, password)
      navigate('/')
    } catch (err) {
      console.error('Login error:', err.response?.status, err.response?.data)
      const code = err.response?.data?.error?.code
      if (code === 'CSRF_TOKEN_INVALID') {
        setError(t('auth.login.csrfError'))
      } else {
        setError(translateError(err) || t('auth.login.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4 relative">
      <LanguageSelector />
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
              <span className="text-2xl font-bold text-primary-600">{BRAND.mark}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{BRAND.name}</h1>
            <p className="text-gray-600 mt-2">{t('auth.login.subtitle')}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.login.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder={t('auth.login.emailPlaceholder')}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.login.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('auth.login.submit')}
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <p className="mt-4 text-center text-sm text-gray-600">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              {t('auth.login.createAccount')}
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
