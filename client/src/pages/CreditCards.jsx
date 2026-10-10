/**
 * @fileoverview Credit Cards management page
 * Provides CRUD operations for credit cards with filtering and sorting
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { creditCardsApi, accountsApi } from '../lib/api'
import { useFormatters, parseAmount } from '../hooks/useFormatters'
import FormattedAmountInput from '../components/FormattedAmountInput'
import { translateError } from '../lib/errorHelper'
import { CreditCard, Calendar, Clock, Plus, Pencil, Trash2, X, Filter, ArrowUpDown } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

/**
 * Modal form for creating or editing a credit card
 * @param {Object} props - Component props
 * @param {Object|null} props.card - Existing card data for editing, null for creation
 * @param {Array} props.accounts - Available bank accounts for linking
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSave - Callback with form data when saved
 */
function CreditCardModal({ card, accounts, accountsLoading, onClose, onSave }) {
  const { t } = useTranslation()
  const eligibleAccounts = useMemo(
    () => accounts?.filter((account) => account.type !== 'credit_card' || account.id === card?.accountId) || [],
    [accounts, card?.accountId]
  )

  const [formData, setFormData] = useState({
    name: card?.name || '',
    accountId: card?.accountId || eligibleAccounts[0]?.id || '',
    linkedAccountId: card?.linkedAccountId || '',
    cardNumberLast4: card?.cardNumberLast4 || '',
    expirationDate: card?.expirationDate || '',
    debitType: card?.debitType || 'deferred',
    cycleStartDay: card?.cycleStartDay || 1,
    debitDay: card?.debitDay || 5,
    creditLimit: card?.creditLimit ? String(card.creditLimit) : '',
    color: card?.color || '#EF4444',
  })

  useEffect(() => {
    if (!formData.accountId && eligibleAccounts.length > 0) {
      setFormData((current) => ({ ...current, accountId: eligibleAccounts[0].id }))
    }
  }, [eligibleAccounts, formData.accountId])

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      name: formData.name,
      accountId: formData.accountId,
      expirationDate: formData.expirationDate,
      debitType: formData.debitType,
      cycleStartDay: parseInt(formData.cycleStartDay),
      color: formData.color,
    }
    if (formData.linkedAccountId) data.linkedAccountId = formData.linkedAccountId
    if (formData.cardNumberLast4) data.cardNumberLast4 = formData.cardNumberLast4
    if (formData.debitType === 'deferred') data.debitDay = parseInt(formData.debitDay)
    if (formData.creditLimit) data.creditLimit = parseAmount(formData.creditLimit)
    onSave(data)
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {card ? t('creditCards.editCard') : t('creditCards.newCardTitle')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.cardName')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder={t('creditCards.cardNamePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.linkedAccount')}</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="input"
              required
              disabled={accountsLoading || eligibleAccounts.length === 0}
            >
              {accountsLoading
                ? <option value="">{t('common.loading')}</option>
                : eligibleAccounts.length === 0
                  ? <option value="">{t('creditCards.noAccountsAvailable', { defaultValue: 'Nenhuma conta disponível' })}</option>
                  : <option value="">{t('creditCards.selectAccount')}</option>}
              {eligibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('creditCards.linkedAccountDesc')}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.last4')}</label>
              <input
                type="text"
                value={formData.cardNumberLast4}
                onChange={(e) => setFormData({ ...formData, cardNumberLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                className="input"
                placeholder="1234"
                maxLength={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.expiration')}</label>
              <input
                type="text"
                value={formData.expirationDate}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
                  if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2)
                  setFormData({ ...formData, expirationDate: val })
                }}
                className="input"
                placeholder={t('creditCards.expirationFormat')}
                maxLength={5}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.creditLimit')}</label>
              <FormattedAmountInput
                value={formData.creditLimit}
                onChange={(val) => setFormData({ ...formData, creditLimit: val })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.debitType')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, debitType: 'deferred' })}
                className={`flex-1 p-3 rounded-lg border-2 text-sm ${
                  formData.debitType === 'deferred'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200'
                }`}
              >
                {t('creditCards.deferred')}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, debitType: 'immediate' })}
                className={`flex-1 p-3 rounded-lg border-2 text-sm ${
                  formData.debitType === 'immediate'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200'
                }`}
              >
                {t('creditCards.immediate')}
              </button>
            </div>
          </div>

          {formData.debitType === 'deferred' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.cycleStart')}</label>
                <select
                  value={formData.cycleStartDay}
                  onChange={(e) => setFormData({ ...formData, cycleStartDay: e.target.value })}
                  className="input"
                >
                  {[...Array(28)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{t('creditCards.dayOfMonth', { n: i + 1 })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditCards.debitDay')}</label>
                <select
                  value={formData.debitDay}
                  onChange={(e) => setFormData({ ...formData, debitDay: e.target.value })}
                  className="input"
                >
                  {[...Array(28)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{t('creditCards.dayOfMonth', { n: i + 1 })}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.color')}</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-10 rounded cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={!formData.accountId || accountsLoading || eligibleAccounts.length === 0} className="btn btn-primary flex-1 disabled:opacity-60">
              {card ? t('common.edit') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

/**
 * Credit Cards page component
 * Displays all credit cards with filtering by status (active/expired)
 * and sorting by name or expiration date
 * @returns {JSX.Element} The credit cards page
 */
export default function CreditCards() {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  /** @type {''|'active'|'expired'} Filter by card status */
  const [statusFilter, setStatusFilter] = useState('')
  /** @type {'name'|'expiration_date'} Sort field */
  const [sortBy, setSortBy] = useState('name')
  /** @type {'asc'|'desc'} Sort direction */
  const [sortOrder, setSortOrder] = useState('asc')
  const queryClient = useQueryClient()

  const { data: cards, isLoading } = useQuery({
    queryKey: ['credit-cards', statusFilter, sortBy, sortOrder],
    queryFn: () => creditCardsApi.getAll({ status: statusFilter, sortBy, sortOrder }).then(r => r.data.data.creditCards),
  })

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: creditCardsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['credit-card-cycle'] })
      setModalOpen(false)
    },
    onError: (err) => alert(translateError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => creditCardsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['credit-card-cycle'] })
      setEditingCard(null)
    },
    onError: (err) => alert(translateError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: creditCardsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['credit-cards'] }),
    onError: (err) => alert(translateError(err)),
  })

  const handleSave = (formData) => {
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (card) => setEditingCard(card)

  const handleDelete = (card) => setDeleteCandidate(card)

  if (isLoading) {
    return <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('creditCards.title')}</h1>
          <p className="text-gray-600">{t('creditCards.subtitle')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          {t('creditCards.newCard')}
        </button>
      </div>

      {/* Filters and sorting */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{t('creditCards.status.label')}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === ''
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('creditCards.status.all')}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === 'active'
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('creditCards.status.active')}
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === 'expired'
                  ? 'bg-red-100 text-red-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('creditCards.status.expired')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{t('creditCards.sort.label')}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="name">{t('creditCards.sort.name')}</option>
            <option value="expiration_date">{t('creditCards.sort.expirationDate')}</option>
          </select>
          <button
            onClick={toggleSortOrder}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={sortOrder === 'asc' ? t('creditCards.sort.asc') : t('creditCards.sort.desc')}
          >
            <ArrowUpDown className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {cards?.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {statusFilter === 'active' && t('creditCards.empty.active')}
            {statusFilter === 'expired' && t('creditCards.empty.expired')}
            {statusFilter === '' && t('creditCards.empty.all')}
          </p>
          {statusFilter === '' && (
            <button onClick={() => setModalOpen(true)} className="btn btn-primary mt-4">
              {t('creditCards.empty.addCard')}
            </button>
          )}
          {statusFilter !== '' && (
            <button onClick={() => setStatusFilter('')} className="btn btn-secondary mt-4">
              {t('creditCards.empty.viewAll')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cards?.map((card) => (
            <CardDetail
              key={card.id}
              card={card}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {(modalOpen || editingCard) && (
        <CreditCardModal
          card={editingCard}
          accounts={accountsData?.data}
          accountsLoading={accountsLoading}
          onClose={() => { setModalOpen(false); setEditingCard(null) }}
          onSave={handleSave}
        />
      )}

      {deleteCandidate && (
        <ConfirmModal
          variant="danger"
          title={t('common.delete')}
          message={t('creditCards.confirmDelete', { name: deleteCandidate.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            deleteMutation.mutate(deleteCandidate.id)
            setDeleteCandidate(null)
          }}
          onClose={() => setDeleteCandidate(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

/**
 * Displays detailed information about a single credit card
 * Shows billing cycle info for deferred debit cards
 * @param {Object} props - Component props
 * @param {Object} props.card - Credit card data
 * @param {Function} props.onEdit - Callback when edit button is clicked
 * @param {Function} props.onDelete - Callback when delete button is clicked
 */
function CardDetail({ card, onEdit, onDelete }) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useFormatters()
  const cycle = card.currentCycle

  /**
   * Checks if the card is expired based on MM/YY format
   * @returns {boolean} True if card is expired
   */
  const isExpired = (() => {
    if (!card.expirationDate) return false
    const [month, year] = card.expirationDate.split('/')
    if (!month || !year) return false
    const expDate = new Date(2000 + parseInt(year), parseInt(month), 0) // Last day of month
    return expDate < new Date()
  })()

  return (
    <div className={`card relative group ${isExpired ? 'bg-gray-200' : ''}`}>
      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(card)}
          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title={t('common.edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(card)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title={t('common.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center ${isExpired ? 'bg-gray-300' : ''}`}
          style={isExpired ? {} : { backgroundColor: card.color + '20', color: card.color }}
        >
          <CreditCard className={`w-7 h-7 ${isExpired ? 'text-gray-400' : ''}`} />
        </div>
        <div className="flex-1 pr-16">
          <h3 className={`text-lg font-semibold flex items-center gap-2 ${isExpired ? 'text-gray-400' : 'text-gray-900'}`}>
            {card.name}
            {isExpired && (
              <span className="text-xs px-2 py-0.5 bg-gray-400 text-gray-100 rounded-full">{t('creditCards.expired')}</span>
            )}
          </h3>
          <p className={`text-sm ${isExpired ? 'text-gray-400' : 'text-gray-500'}`}>
            {card.debitType === 'deferred' ? t('creditCards.deferredDebit') : t('creditCards.immediateDebit')}
            {card.cardNumberLast4 && ` •••• ${card.cardNumberLast4}`}
            {card.expirationDate && ` • ${t('creditCards.exp')} ${card.expirationDate}`}
          </p>
          {card.accountName && (
            <p className="text-xs text-gray-400">{t('creditCards.linkedTo', { name: card.accountName })}</p>
          )}
        </div>
      </div>

      {/* Credit limit - displayed below main info */}
      {card.creditLimit && (
        <div className={`flex items-center justify-between p-3 rounded-lg mb-4 ${isExpired ? 'bg-gray-300' : 'bg-gray-50'}`}>
          <span className={`text-sm ${isExpired ? 'text-gray-400' : 'text-gray-600'}`}>{t('creditCards.creditLimit')}</span>
          <span className={`font-semibold ${isExpired ? 'text-gray-400' : ''}`}>{formatCurrency(card.creditLimit)}</span>
        </div>
      )}

      {card.debitType === 'deferred' && cycle && !isExpired && (
        <>
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                {t('creditCards.currentCycle')}
              </div>
              <span className="badge bg-primary-100 text-primary-700">
                {cycle.status === 'open' ? t('creditCards.cycleStatus.open') : t('creditCards.cycleStatus.pending')}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {t('creditCards.cycleRange', { start: formatDate(cycle.cycleStartDate), end: formatDate(cycle.cycleEndDate) })}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('creditCards.cycleTotal')}</span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(cycle.totalAmount || 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg text-amber-800">
            <Clock className="w-5 h-5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('creditCards.nextDebit')}</p>
              <p className="text-xs">{formatDate(cycle.debitDate)}</p>
            </div>
            <span className="font-semibold">{formatCurrency(cycle.totalAmount || 0)}</span>
          </div>

          {cycle.transactions?.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-700">{t('creditCards.recentOperations')}</h4>
              <div className="space-y-2">
                {cycle.transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-gray-600">{transaction.description}</span>
                    <span className="shrink-0 font-medium">{formatCurrency(Math.abs(transaction.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}

      {card.debitType === 'immediate' && !isExpired && (
        <div className="text-center py-6 text-gray-500">
          <p>{t('creditCards.immediateMessage')}</p>
        </div>
      )}
    </div>
  )
}
