import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../lib/brand'
import { Lock, ArrowLeft, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { authApi, preloadCsrfToken } from '../lib/api'
import PasswordInput from '../components/PasswordInput'
import LanguageSelector from '../components/LanguageSelector'

/**
 * Password strength indicator
 */
function PasswordStrength({ password }) {
  const { t } = useTranslation()

  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '' }
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z\d]/.test(password)) score++

    const labels = [
      t('auth.resetPassword.strength.weak'),
      t('auth.resetPassword.strength.weak'),
      t('auth.resetPassword.strength.fair'),
      t('auth.resetPassword.strength.good'),
      t('auth.resetPassword.strength.strong'),
      t('auth.resetPassword.strength.veryStrong'),
    ]
    const colors = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-green-600']

    return { score, label: labels[score], color: colors[score] }
  }, [password, t])

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < strength.score ? strength.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">{strength.label}</p>
    </div>
  )
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { t } = useTranslation()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false)
      return
    }

    authApi.validateResetToken(token)
      .then(() => {
        setTokenValid(true)
      })
      .catch(() => {
        setTokenValid(false)
      })
      .finally(() => {
        setValidating(false)
      })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError(t('auth.resetPassword.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await preloadCsrfToken()
      await authApi.resetPassword(token, password, passwordConfirm)
      setSuccess(true)
    } catch (err) {
      const code = err.response?.data?.error?.code
      if (code === 'INVALID_RESET_TOKEN') {
        setError(t('auth.resetPassword.invalidToken'))
      } else {
        setError(err.response?.data?.error?.message || t('common.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  // Invalid or missing token
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4 relative">
        <LanguageSelector />
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('auth.resetPassword.invalidToken')}</h1>
            <p className="text-gray-600 mb-6">{t('auth.resetPassword.invalidTokenDesc')}</p>
            <Link
              to="/forgot-password"
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {t('auth.resetPassword.requestNew')}
            </Link>
          </div>
        </div>
      </div>
    )
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
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.resetPassword.title')}</h1>
            <p className="text-gray-600 mt-2">{t('auth.resetPassword.subtitle')}</p>
          </div>

          {success ? (
            /* Success state */
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-700 mb-6">{t('auth.resetPassword.success')}</p>
              <Link
                to="/login"
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
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
                    {t('auth.resetPassword.newPassword')}
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
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.resetPassword.confirmPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                    <PasswordInput
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="input pl-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  {passwordConfirm && password !== passwordConfirm && (
                    <p className="mt-1 text-sm text-red-600">{t('auth.resetPassword.passwordMismatch')}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !passwordConfirm}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      {t('auth.resetPassword.submit')}
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-600">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
