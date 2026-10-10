import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { parseLocalDate } from '../lib/utils'

const intlLocales = {
  de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
  pt: 'pt-BR', ru: 'ru-RU', sv: 'sv-SE', zh: 'zh-CN',
}

/**
 * Format a number using the given decimal separator and digit grouping.
 * @param {number} amount - The number to format
 * @param {string} decimalSep - Decimal separator (',' or '.')
 * @param {string} digitGroup - Digit grouping symbol (' ', ',', '.', or '')
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string}
 */
export function formatNumber(amount, decimalSep = ',', digitGroup = ' ', decimals = 2) {
  const fixed = Math.abs(amount).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')

  // Add digit grouping to integer part
  let grouped = intPart
  if (digitGroup) {
    grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, digitGroup)
  }

  const formatted = decPart ? `${grouped}${decimalSep}${decPart}` : grouped
  return amount < 0 ? `-${formatted}` : formatted
}

/**
 * Parse a user-entered amount string into a number.
 * Accepts both '.' and ',' as decimal separators.
 * Strips any digit grouping characters.
 * @param {string} value - Raw input string
 * @returns {number}
 */
export function parseAmount(value) {
  if (!value || typeof value !== 'string') return 0
  // Remove spaces and non-breaking spaces (digit grouping)
  let cleaned = value.replace(/[\s\u00A0]/g, '')
  // Determine which is the decimal separator:
  // If both '.' and ',' exist, the last one is the decimal separator
  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  if (lastDot > lastComma) {
    // Dot is decimal separator: remove commas (grouping)
    cleaned = cleaned.replace(/,/g, '')
  } else if (lastComma > lastDot) {
    // Comma is decimal separator: remove dots (grouping), replace comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const result = parseFloat(cleaned)
  return isNaN(result) ? 0 : result
}

/**
 * Hook providing locale-aware formatters for currency, dates, and relative dates
 * @returns {{ formatCurrency: Function, formatDate: Function, formatDateRelative: Function, formatAmount: Function, parseAmount: Function, locale: string, decimalSeparator: string, digitGrouping: string }}
 */
export function useFormatters() {
  const { t, i18n } = useTranslation()
  const { user, activeWorkspace } = useAuth()
  const locale = activeWorkspace?.locale || i18n.language || user?.locale || 'fr'
  const decimalSeparator = activeWorkspace?.decimalSeparator ?? user?.decimalSeparator ?? ','
  const digitGrouping = activeWorkspace?.digitGrouping ?? user?.digitGrouping ?? ' '

  const formatters = useMemo(() => {
    const formatCurrency = (amount, currency) => {
      const cur = currency || activeWorkspace?.currency || user?.currency || 'EUR'
      const formatted = formatNumber(amount, decimalSeparator, digitGrouping)
      // Append currency symbol
      const symbols = { EUR: '\u202F\u20AC', USD: '\u202F$', GBP: '\u202F\u00A3', CHF: '\u202FCHF', CAD: '\u202FCA$', BRL: 'R$' }
      return cur === 'BRL'
        ? `R$\u00A0${formatted}`
        : `${formatted}${symbols[cur] || ` ${cur}`}`
    }

    const formatAmount = (amount, decimals = 2) => {
      return formatNumber(amount, decimalSeparator, digitGrouping, decimals)
    }

    const intlLocale = intlLocales[locale] || 'en-US'

    const formatDate = (date) => {
      return new Intl.DateTimeFormat(intlLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(parseLocalDate(date))
    }

    const formatDateRelative = (date) => {
      const now = new Date()
      const d = parseLocalDate(date)
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))

      if (diff === 0) return t('dates.today')
      if (diff === 1) return t('dates.yesterday')
      // Only use "N days ago" for the recent past; future dates (diff < 0) and
      // anything a week or older fall back to the absolute date.
      if (diff >= 2 && diff < 7) return t('dates.daysAgo', { count: diff })
      return formatDate(date)
    }

    return { formatCurrency, formatAmount, formatDate, formatDateRelative, parseAmount, locale, decimalSeparator, digitGrouping }
  }, [locale, decimalSeparator, digitGrouping, activeWorkspace?.currency, user?.currency, t])

  return formatters
}
