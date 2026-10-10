/**
 * @fileoverview Unit tests for TransactionModal card/check ↔ account consistency
 * Tests auto-selection and validation blocking for credit card and check payment methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock i18n: return the key with interpolation replaced
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => {
      if (params) {
        let result = key
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{{${k}}}`, v)
        }
        return result
      }
      return key
    },
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

// Mock i18n module to prevent side-effect initialization
vi.mock('../../src/i18n', () => ({
  default: { language: 'fr', t: (k) => k, use: () => ({ init: () => {} }) },
}))

// Mock errorHelper to prevent i18n side-effect initialization
vi.mock('../../src/lib/errorHelper', () => ({
  translateError: (err) => err?.response?.data?.message || err?.message || 'Error',
}))

// Mock useFormatters
vi.mock('../../src/hooks/useFormatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v) => `$${v}`,
    formatDate: (d) => d,
  }),
  parseAmount: (v) => parseFloat(v) || 0,
}))

// Mock FormattedAmountInput
vi.mock('../../src/components/FormattedAmountInput', () => ({
  default: ({ value, onChange, ...props }) => (
    <input
      data-testid="amount-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  ),
}))

// Mock SearchableSelect
vi.mock('../../src/components/SearchableSelect', () => ({
  default: ({ value, onChange, options, placeholder }) => (
    <select data-testid={placeholder} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      {options?.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  ),
}))

// Mock iconMap
vi.mock('../../src/lib/iconMap', () => ({
  getIconComponent: () => () => <span>icon</span>,
}))

// Mock knownLogos
vi.mock('../../src/lib/knownLogos', () => ({
  findKnownLogo: () => null,
}))

// Mock AuthContext
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ userSettings: {} }),
}))

import { TransactionModal } from '../../src/pages/Transactions'

const mockAccounts = [
  { id: 'acc-checking', name: 'Compte Courant', type: 'checking' },
  { id: 'acc-savings', name: 'Livret Épargne', type: 'savings' },
  { id: 'acc-invest', name: 'Investissement', type: 'investment' },
]

const mockCreditCards = [
  { id: 'cc-1', name: 'Visa Gold', accountId: 'acc-checking' },
  { id: 'cc-2', name: 'Mastercard Plat', accountId: 'acc-savings' },
]

const mockCategories = [
  { id: 'cat-1', name: 'Alimentation', type: 'expense' },
]

const mockPayees = [
  { id: 'pay-1', name: 'Supermarché' },
]

const mockToast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }

const defaultProps = {
  transaction: null,
  accounts: mockAccounts,
  categories: mockCategories,
  payees: mockPayees,
  creditCards: mockCreditCards,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onCreatePayee: vi.fn(),
  onCreateCategory: vi.fn(),
  toast: mockToast,
}

/**
 * Helper to get the account select element in non-transfer mode
 */
function getAccountSelect(container) {
  // The account select is the one that has 'acc-checking' as an option
  const selects = container.querySelectorAll('select')
  for (const select of selects) {
    const options = Array.from(select.options).map(o => o.value)
    if (options.includes('acc-checking') && !select.dataset.testid) {
      return select
    }
  }
  return null
}

describe('TransactionModal - Card/Check ↔ Account Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Credit card auto-selection', () => {
    it('auto-selects the card account when a credit card is chosen', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Click the card button to enter card selection mode
      const cardButton = screen.getByText('transactions.card')
      fireEvent.click(cardButton)

      // Select a credit card
      const cardSelect = container.querySelector('select')
      fireEvent.change(cardSelect, { target: { value: 'cc-1' } })

      // The account select should now have the card's account selected
      const accountSelect = getAccountSelect(container)
      expect(accountSelect.value).toBe('acc-checking')
    })

    it('offers installments for deferred cards and submits the selected count', () => {
      const onSave = vi.fn()
      const { container } = render(
        <TransactionModal
          {...defaultProps}
          onSave={onSave}
          creditCards={[{ id: 'cc-deferred', name: 'Visa Parcelado', accountId: 'acc-checking', debitType: 'deferred' }]}
        />
      )

      fireEvent.click(screen.getByText('transactions.card'))
      fireEvent.change(container.querySelector('select'), { target: { value: 'cc-deferred' } })
      fireEvent.change(container.querySelector('#installment-count'), { target: { value: '3' } })
      fireEvent.submit(container.querySelector('form'))

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ installmentCount: 3 }))
    })

    it('auto-selects a different account when switching cards', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Enter card selection mode
      fireEvent.click(screen.getByText('transactions.card'))

      // Select first card (linked to acc-checking)
      const cardSelect = container.querySelector('select')
      fireEvent.change(cardSelect, { target: { value: 'cc-1' } })

      let accountSelect = getAccountSelect(container)
      expect(accountSelect.value).toBe('acc-checking')

      // Switch to second card (linked to acc-savings)
      // Need to re-query the card select after state update
      const updatedCardSelect = container.querySelector('select')
      fireEvent.change(updatedCardSelect, { target: { value: 'cc-2' } })

      accountSelect = getAccountSelect(container)
      expect(accountSelect.value).toBe('acc-savings')
    })
  })

  describe('Credit card account mismatch', () => {
    it('shows inline warning when account does not match card', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Select card
      fireEvent.click(screen.getByText('transactions.card'))
      const cardSelect = container.querySelector('select')
      fireEvent.change(cardSelect, { target: { value: 'cc-1' } })

      // Manually change account to a different one
      const accountSelect = getAccountSelect(container)
      fireEvent.change(accountSelect, { target: { value: 'acc-savings' } })

      // Should display inline warning
      expect(screen.getByText(/transactions\.accountCardMismatch/)).toBeInTheDocument()
    })

    it('blocks submission when account does not match card', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Select card
      fireEvent.click(screen.getByText('transactions.card'))
      const cardSelect = container.querySelector('select')
      fireEvent.change(cardSelect, { target: { value: 'cc-1' } })

      // Manually change account to mismatch
      const accountSelect = getAccountSelect(container)
      fireEvent.change(accountSelect, { target: { value: 'acc-savings' } })

      // Fill required fields
      const amountInput = screen.getByTestId('amount-input')
      fireEvent.change(amountInput, { target: { value: '100' } })

      const descInput = container.querySelector('input[type="text"][required]')
      fireEvent.change(descInput, { target: { value: 'Test' } })

      // Submit form
      const form = container.querySelector('form')
      fireEvent.submit(form)

      // Should block with toast error
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('transactions.accountCardMismatch')
      )
      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })

    it('does not show warning when account matches card', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Select card (auto-selects matching account)
      fireEvent.click(screen.getByText('transactions.card'))
      const cardSelect = container.querySelector('select')
      fireEvent.change(cardSelect, { target: { value: 'cc-1' } })

      // Should not display warning
      expect(screen.queryByText(/transactions\.accountCardMismatch/)).not.toBeInTheDocument()
    })
  })

  describe('Check auto-selection', () => {
    it('auto-selects first checking account when current is not checking', () => {
      // Start with a savings account selected
      const propsWithSavings = {
        ...defaultProps,
        transaction: null,
      }
      const { container } = render(<TransactionModal {...propsWithSavings} />)

      // Change account to savings first
      const accountSelect = getAccountSelect(container)
      fireEvent.change(accountSelect, { target: { value: 'acc-savings' } })

      // Enter check mode
      fireEvent.click(screen.getByText('transactions.check'))

      // Type a check number
      const checkInput = container.querySelector('input[type="text"][maxlength="50"]')
      fireEvent.change(checkInput, { target: { value: '0001234' } })

      // Account should auto-switch to first checking account
      const updatedAccountSelect = getAccountSelect(container)
      expect(updatedAccountSelect.value).toBe('acc-checking')
    })

    it('does not change account when current account is already checking', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Default account is acc-checking (first in list)
      // Enter check mode
      fireEvent.click(screen.getByText('transactions.check'))

      // Type a check number
      const checkInput = container.querySelector('input[type="text"][maxlength="50"]')
      fireEvent.change(checkInput, { target: { value: '0001234' } })

      // Account should remain as checking
      const accountSelect = getAccountSelect(container)
      expect(accountSelect.value).toBe('acc-checking')
    })
  })

  describe('Check with non-checking account', () => {
    it('shows inline warning when check is used with non-checking account', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Enter check mode and type a check number
      fireEvent.click(screen.getByText('transactions.check'))
      const checkInput = container.querySelector('input[type="text"][maxlength="50"]')
      fireEvent.change(checkInput, { target: { value: '0001234' } })

      // Manually change account to savings
      const accountSelect = getAccountSelect(container)
      fireEvent.change(accountSelect, { target: { value: 'acc-savings' } })

      // Should display inline warning
      expect(screen.getByText('transactions.checkRequiresChecking')).toBeInTheDocument()
    })

    it('blocks submission when check is used with non-checking account', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Enter check mode
      fireEvent.click(screen.getByText('transactions.check'))
      const checkInput = container.querySelector('input[type="text"][maxlength="50"]')
      fireEvent.change(checkInput, { target: { value: '0001234' } })

      // Change to savings account
      const accountSelect = getAccountSelect(container)
      fireEvent.change(accountSelect, { target: { value: 'acc-savings' } })

      // Fill required fields
      const amountInput = screen.getByTestId('amount-input')
      fireEvent.change(amountInput, { target: { value: '50' } })

      const descInput = container.querySelector('input[type="text"][required]')
      fireEvent.change(descInput, { target: { value: 'Test check' } })

      // Submit
      const form = container.querySelector('form')
      fireEvent.submit(form)

      expect(mockToast.error).toHaveBeenCalledWith('transactions.checkRequiresChecking')
      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })

    it('does not show warning when check is used with checking account', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Enter check mode (default account is checking)
      fireEvent.click(screen.getByText('transactions.check'))
      const checkInput = container.querySelector('input[type="text"][maxlength="50"]')
      fireEvent.change(checkInput, { target: { value: '0001234' } })

      // No warning expected
      expect(screen.queryByText('transactions.checkRequiresChecking')).not.toBeInTheDocument()
    })
  })

  describe('Successful submission', () => {
    it('allows submission when card and account match', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Select card (auto-selects matching account)
      fireEvent.click(screen.getByText('transactions.card'))
      const cardSelect = container.querySelector('select')
      fireEvent.change(cardSelect, { target: { value: 'cc-1' } })

      // Fill required fields
      const amountInput = screen.getByTestId('amount-input')
      fireEvent.change(amountInput, { target: { value: '100' } })

      const descInput = container.querySelector('input[type="text"][required]')
      fireEvent.change(descInput, { target: { value: 'Achat' } })

      // Submit
      const form = container.querySelector('form')
      fireEvent.submit(form)

      expect(mockToast.error).not.toHaveBeenCalled()
      expect(defaultProps.onSave).toHaveBeenCalled()
    })

    it('allows submission when check is used with checking account', () => {
      const { container } = render(<TransactionModal {...defaultProps} />)

      // Enter check mode (default account is checking)
      fireEvent.click(screen.getByText('transactions.check'))
      const checkInput = container.querySelector('input[type="text"][maxlength="50"]')
      fireEvent.change(checkInput, { target: { value: '0001234' } })

      // Fill required fields
      const amountInput = screen.getByTestId('amount-input')
      fireEvent.change(amountInput, { target: { value: '50' } })

      const descInput = container.querySelector('input[type="text"][required]')
      fireEvent.change(descInput, { target: { value: 'Loyer' } })

      // Submit
      const form = container.querySelector('form')
      fireEvent.submit(form)

      expect(mockToast.error).not.toHaveBeenCalled()
      expect(defaultProps.onSave).toHaveBeenCalled()
    })
  })
})
