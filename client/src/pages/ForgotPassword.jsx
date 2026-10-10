import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../lib/brand'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { authApi, preloadCsrfToken } from '../lib/api'
import LanguageSelector from '../components/LanguageSelector'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await preloadCsrfToken()
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('common.error'))
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
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.forgotPassword.title')}</h1>
            <p className="text-gray-600 mt-2">{t('auth.forgotPassword.subtitle')}</p>
          </div>

          {sent ? (
            /* Success state */
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-700 mb-6">{t('auth.forgotPassword.sent')}</p>
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
                    {t('common.email')}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      {t('auth.forgotPassword.submit')}
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
