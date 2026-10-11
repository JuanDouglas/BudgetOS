/**
 * @fileoverview Reusable modal component
 * Provides a backdrop overlay with click-outside and escape key handling
 * Respects the user's modalPersistent setting to prevent accidental closes
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Modal component with overlay backdrop
 * Closes on Escape key press or click outside the content
 * When modalPersistent setting is enabled, click-outside is disabled
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Modal content
 * @param {Function} props.onClose - Callback when modal should close
 * @param {string} [props.className=''] - Additional CSS classes for the overlay
 * @returns {JSX.Element} The modal component
 */
export default function Modal({ children, onClose, className = '' }) {
  const overlayRef = useRef(null)
  const returnFocusRef = useRef(null)
  const { userSettings } = useAuth()
  const persistent = userSettings?.modalPersistent ?? false

  useEffect(() => {
    returnFocusRef.current = document.activeElement
    const firstFocusable = overlayRef.current?.querySelector(FOCUSABLE_SELECTOR)
    ;(firstFocusable || overlayRef.current)?.focus()

    return () => {
      const returnFocus = returnFocusRef.current
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(overlayRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
        .filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        overlayRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !overlayRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !overlayRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /**
   * Handles click on overlay to close modal
   * Only closes if click is directly on overlay, not on children
   * Disabled when modalPersistent setting is enabled
   */
  const handleOverlayClick = (e) => {
    if (persistent) return
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      onClick={handleOverlayClick}
      className={`fixed inset-0 overscroll-contain bg-black/50 flex items-center justify-center z-50 p-4 ${className}`}
    >
      {children}
    </div>
  )
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
