/**
 * @fileoverview Utility functions for BudgetOS frontend
 * Provides formatting helpers and class name utilities
 */

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS classes with conflict resolution
 * Combines clsx for conditional classes with tailwind-merge for deduplication
 * @param {...(string|Object|Array)} inputs - Class names or conditional class objects
 * @returns {string} Merged class string
 * @example
 * cn('px-2 py-1', condition && 'bg-blue-500', 'px-4') // => 'py-1 bg-blue-500 px-4'
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - ISO 4217 currency code (default: 'BRL')
 * @returns {string} Formatted currency string (e.g., "1 234,56 €")
 * @example
 * formatCurrency(1234.56) // => "R$ 1.234,56"
 * formatCurrency(1234.56, 'USD') // => "1 234,56 $US"
 */
export function formatCurrency(amount, currency = 'BRL', locale = 'pt') {
  const intlLocales = {
    de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
    pt: 'pt-BR', ru: 'ru-RU', sv: 'sv-SE', zh: 'zh-CN',
  }
  const intlLocale = intlLocales[locale] || 'en-US'
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Parses a date value, interpreting bare 'YYYY-MM-DD' strings as local dates.
 * `new Date('2026-01-20')` parses as UTC midnight, which formats to the previous
 * day in timezones west of UTC. This treats date-only strings as local instead.
 * Strings with a time component and Date objects are passed through unchanged.
 * @param {string|Date} date - Date value to parse
 * @returns {Date}
 */
export function parseLocalDate(date) {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    }
  }
  return new Date(date)
}

/**
 * Formats a date in Brazilian Portuguese locale (dd/MM/yyyy)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string (e.g., "20/01/2026")
 * @example
 * formatDate('2026-01-20') // => "20/01/2026"
 */
export function formatDate(date, locale = 'pt') {
  const intlLocales = {
    de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
    pt: 'pt-BR', ru: 'ru-RU', sv: 'sv-SE', zh: 'zh-CN',
  }
  const intlLocale = intlLocales[locale] || 'en-US'
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseLocalDate(date))
}

/**
 * Formats a date as a relative string in French
 * @param {string|Date} date - Date to format
 * @returns {string} Relative date string (e.g., "Aujourd'hui", "Hier", "Il y a 3 jours")
 * @example
 * formatDateRelative(new Date()) // => "Aujourd'hui"
 * formatDateRelative(yesterday) // => "Hier"
 */
export function formatDateRelative(date) {
  const now = new Date()
  const d = parseLocalDate(date)
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))

  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  // Only relative for the recent past; future dates (diff < 0) show the date.
  if (diff >= 2 && diff < 7) return `Il y a ${diff} jours`
  return formatDate(date)
}

/**
 * Formats a date as YYYY-MM-DD in local timezone
 * Unlike toISOString() which converts to UTC, this preserves local date
 * @param {Date} date - Date to format
 * @returns {string} Date string in YYYY-MM-DD format
 * @example
 * formatLocalDate(new Date(2026, 0, 21)) // => "2026-01-21"
 */
export function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates start and end dates for a given period
 * @param {string} period - Period identifier ('week', '7days', 'month', '30days', 'year', '365days')
 * @param {number} weekStartDay - First day of week: 0 = Sunday, 1 = Monday (default), 6 = Saturday
 * @returns {{ startDate: string, endDate: string }} Object with start and end dates in YYYY-MM-DD format
 */
export function getDatePeriod(period, weekStartDay = 1) {
  const now = new Date()
  const endDate = formatLocalDate(now)
  let startDate

  switch (period) {
    case 'week': {
      const day = now.getDay()
      let diff
      if (weekStartDay === 0) {
        diff = day
      } else if (weekStartDay === 6) {
        diff = day === 6 ? 0 : day + 1
      } else {
        diff = day === 0 ? 6 : day - 1
      }
      const firstDayOfWeek = new Date(now)
      firstDayOfWeek.setDate(now.getDate() - diff)
      startDate = formatLocalDate(firstDayOfWeek)
      break
    }
    case '7days': {
      const past = new Date(now)
      past.setDate(now.getDate() - 6)
      startDate = formatLocalDate(past)
      break
    }
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      startDate = formatLocalDate(firstDay)
      break
    }
    case '30days': {
      const past = new Date(now)
      past.setDate(now.getDate() - 29)
      startDate = formatLocalDate(past)
      break
    }
    case 'year': {
      const firstDay = new Date(now.getFullYear(), 0, 1)
      startDate = formatLocalDate(firstDay)
      break
    }
    case '365days': {
      const past = new Date(now)
      past.setDate(now.getDate() - 364)
      startDate = formatLocalDate(past)
      break
    }
    case 'currentMonthFull': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: formatLocalDate(firstDay), endDate: formatLocalDate(lastDay) }
    }
    case 'nextMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      return { startDate: formatLocalDate(firstDay), endDate: formatLocalDate(lastDay) }
    }
    default:
      startDate = ''
  }

  return { startDate, endDate }
}
