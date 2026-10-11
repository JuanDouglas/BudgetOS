/**
 * Account model tests
 * Uses an in-memory Knex (better-sqlite3) instance
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  setupTestDb,
  closeTestDb,
  resetTestDb,
  getTestDb,
  createTestUser,
  createTestAccount,
  createTestTransaction,
} from '../setup.js'

// Mock the database connection module
vi.mock('../../src/database/connection.js', async () => {
  const setup = await vi.importActual('../setup.js')
  const knexInstance = await setup.setupTestDb()

  return {
    default: knexInstance,
    knex: knexInstance,
    initDatabase: async () => knexInstance,
    closeDatabase: async () => {},
    transaction: async (fn) => knexInstance.transaction(fn),
  }
})

// Import after mocking
const { Account } = await import('../../src/models/Account.js')

// Single setup/teardown for all tests in this file
beforeAll(async () => {
  await setupTestDb()
})

afterAll(async () => {
  await closeTestDb()
})

describe('Account.create', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('creates account with required fields', async () => {
    const account = await Account.create(userId, {
      name: 'Checking',
      type: 'checking',
    })

    expect(account).not.toBeNull()
    expect(account.name).toBe('Checking')
    expect(account.type).toBe('checking')
    expect(account.userId).toBe(userId)
  })

  it('creates account with default values', async () => {
    const account = await Account.create(userId, {
      name: 'Test',
      type: 'savings',
    })

    expect(account.initialBalance).toBe(0)
    expect(account.currentBalance).toBe(0)
    expect(account.currency).toBe('BRL')
    expect(account.color).toBe('#3B82F6')
    expect(account.icon).toBe('wallet')
    expect(account.isIncludedInTotal).toBe(true)
  })

  it('creates account with custom values', async () => {
    const account = await Account.create(userId, {
      name: 'Savings',
      type: 'savings',
      initialBalance: 1000,
      currency: 'USD',
      color: '#FF0000',
      icon: 'piggy-bank',
      isIncludedInTotal: false,
      institution: 'My Bank',
    })

    expect(account.initialBalance).toBe(1000)
    expect(account.currentBalance).toBe(1000)
    expect(account.currency).toBe('USD')
    expect(account.color).toBe('#FF0000')
    expect(account.icon).toBe('piggy-bank')
    expect(account.isIncludedInTotal).toBe(false)
    expect(account.institution).toBe('My Bank')
  })
})

describe('Account.findById', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('returns account when found', async () => {
    const accountId = await createTestAccount(userId, 'acc-1', 'Test Account')
    const account = await Account.findById(accountId, userId)

    expect(account).not.toBeNull()
    expect(account.id).toBe(accountId)
    expect(account.name).toBe('Test Account')
  })

  it('returns null when account not found', async () => {
    const account = await Account.findById('non-existent', userId)
    expect(account).toBeNull()
  })

  it('returns null when user does not own account', async () => {
    const otherUserId = await createTestUser('other-user')
    const accountId = await createTestAccount(otherUserId, 'acc-1', 'Other Account')

    const account = await Account.findById(accountId, userId)
    expect(account).toBeNull()
  })
})

describe('Account.findByIdOrFail', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('returns account when found', async () => {
    const accountId = await createTestAccount(userId)
    const account = await Account.findByIdOrFail(accountId, userId)
    expect(account).not.toBeNull()
  })

  it('throws NotFoundError when account not found', async () => {
    await expect(Account.findByIdOrFail('non-existent', userId))
      .rejects.toThrow('Account not found')
  })
})

describe('Account.findByUser', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('returns all accounts for user', async () => {
    await createTestAccount(userId, 'acc-1', 'Account 1')
    await createTestAccount(userId, 'acc-2', 'Account 2')

    const result = await Account.findByUser(userId)

    expect(result.data).toHaveLength(2)
  })

  it('filters by account type', async () => {
    await createTestAccount(userId, 'acc-1', 'Checking')

    const result = await Account.findByUser(userId, { type: 'checking' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].type).toBe('checking')
  })

  it('includes totals by default', async () => {
    await createTestAccount(userId, 'acc-1', 'Account 1')

    const result = await Account.findByUser(userId)

    expect(result.totals).not.toBeNull()
    expect(result.totals.totalBalance).toBeDefined()
    expect(result.totals.accountCount).toBe(1)
  })

  it('excludes totals when requested', async () => {
    await createTestAccount(userId, 'acc-1', 'Account 1')

    const result = await Account.findByUser(userId, { includeBalance: false })

    expect(result.totals).toBeNull()
  })

  it('orders by sort_order and name', async () => {
    const db = getTestDb()
    await db('accounts').insert({
      id: 'acc-b', user_id: userId, name: 'B Account', type: 'checking',
      initial_balance: 0, current_balance: 0, sort_order: 2,
    })
    await db('accounts').insert({
      id: 'acc-a', user_id: userId, name: 'A Account', type: 'checking',
      initial_balance: 0, current_balance: 0, sort_order: 1,
    })

    const result = await Account.findByUser(userId)

    expect(result.data[0].name).toBe('A Account')
    expect(result.data[1].name).toBe('B Account')
  })
})

describe('Account.update', () => {
  let userId
  let accountId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
    accountId = await createTestAccount(userId)
  })

  it('updates allowed fields', async () => {
    const updated = await Account.update(accountId, userId, {
      name: 'Updated Name',
      color: '#00FF00',
    })

    expect(updated.name).toBe('Updated Name')
    expect(updated.color).toBe('#00FF00')
  })

  it('converts camelCase to snake_case', async () => {
    const updated = await Account.update(accountId, userId, {
      isIncludedInTotal: false,
    })

    expect(updated.isIncludedInTotal).toBe(false)
  })

  it('throws NotFoundError for non-existent account', async () => {
    await expect(Account.update('non-existent', userId, { name: 'Test' }))
      .rejects.toThrow('Account not found')
  })
})

describe('Account.updateBalance', () => {
  let userId
  let accountId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
    const db = getTestDb()
    await db('accounts').insert({
      id: 'test-account', user_id: userId, name: 'Test Account', type: 'checking',
      initial_balance: 1000, current_balance: 1000,
    })
    accountId = 'test-account'
  })

  it('calculates balance from initial balance and transactions', async () => {
    await createTestTransaction(userId, accountId, { amount: -100 })
    await createTestTransaction(userId, accountId, { amount: -50 })
    await createTestTransaction(userId, accountId, { amount: 200 })

    const newBalance = await Account.updateBalance(accountId, userId)

    // 1000 + (-100) + (-50) + 200 = 1050
    expect(newBalance).toBe(1050)
  })

  it('handles account with no transactions', async () => {
    const newBalance = await Account.updateBalance(accountId, userId)
    expect(newBalance).toBe(1000)
  })
})

describe('Account.calculateTotals', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('calculates total balance', async () => {
    const db = getTestDb()
    await db('accounts').insert({
      id: 'acc-1', user_id: userId, name: 'Account 1', type: 'checking',
      current_balance: 1000, is_included_in_total: true,
    })
    await db('accounts').insert({
      id: 'acc-2', user_id: userId, name: 'Account 2', type: 'savings',
      current_balance: 2000, is_included_in_total: true,
    })

    const totals = await Account.calculateTotals(userId)

    expect(totals.totalBalance).toBe(3000)
    expect(totals.accountCount).toBe(2)
  })

  it('excludes accounts not included in total', async () => {
    const db = getTestDb()
    await db('accounts').insert({
      id: 'acc-1', user_id: userId, name: 'Account 1', type: 'checking',
      current_balance: 1000, is_included_in_total: true,
    })
    await db('accounts').insert({
      id: 'acc-2', user_id: userId, name: 'Account 2', type: 'checking',
      current_balance: 500, is_included_in_total: false,
    })

    const totals = await Account.calculateTotals(userId)

    expect(totals.totalBalance).toBe(1000)
  })

  it('calculates available vs investment balance', async () => {
    const db = getTestDb()
    await db('accounts').insert({
      id: 'acc-1', user_id: userId, name: 'Checking', type: 'checking',
      current_balance: 1000, is_included_in_total: true,
    })
    await db('accounts').insert({
      id: 'acc-2', user_id: userId, name: 'Investment', type: 'investment',
      current_balance: 5000, is_included_in_total: true,
    })

    const totals = await Account.calculateTotals(userId)

    expect(totals.availableBalance).toBe(1000)
    expect(totals.investmentBalance).toBe(5000)
    expect(totals.totalBalance).toBe(6000)
  })
})

describe('Account.delete', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('refuses to delete an active account', async () => {
    const accountId = await createTestAccount(userId)

    await expect(Account.delete(accountId, userId))
      .rejects.toThrow('Account must be deactivated before permanent deletion')

    const db = getTestDb()
    const row = await db('accounts').where('id', accountId).first()
    expect(row).toBeDefined()
    expect(row.is_active).toBeTruthy()
  })

  it('hard deletes a deactivated account (no transactions)', async () => {
    const accountId = await createTestAccount(userId)
    await Account.deactivate(accountId, userId)

    const result = await Account.delete(accountId, userId)
    expect(result.deleted).toBe(true)

    const db = getTestDb()
    const row = await db('accounts').where('id', accountId).first()
    expect(row).toBeUndefined()
  })

  it('hard deletes a deactivated account and cascades transactions', async () => {
    const accountId = await createTestAccount(userId)
    await createTestTransaction(userId, accountId)
    await Account.deactivate(accountId, userId)

    await Account.delete(accountId, userId)

    const db = getTestDb()
    const account = await db('accounts').where('id', accountId).first()
    expect(account).toBeUndefined()
    const txs = await db('transactions').where('account_id', accountId)
    expect(txs).toHaveLength(0)
  })

  it('throws NotFoundError for non-existent account', async () => {
    await expect(Account.delete('non-existent', userId))
      .rejects.toThrow('Account not found')
  })
})

describe('Account.deactivate', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('marks the account as inactive and pauses linked planned transactions', async () => {
    const accountId = await createTestAccount(userId)
    const db = getTestDb()
    await db('planned_transactions').insert({
      id: 'pt-deact-1',
      user_id: userId,
      account_id: accountId,
      amount: -50,
      description: 'Linked PT',
      type: 'expense',
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      is_active: true,
    })

    const result = await Account.deactivate(accountId, userId)
    expect(result.deactivated).toBe(true)
    expect(result.alreadyInactive).toBe(false)

    const row = await db('accounts').where('id', accountId).first()
    expect(row.is_active).toBeFalsy()
    const pt = await db('planned_transactions').where('id', 'pt-deact-1').first()
    expect(pt.is_active).toBeFalsy()
  })

  it('is idempotent on an already inactive account', async () => {
    const accountId = await createTestAccount(userId)
    await Account.deactivate(accountId, userId)
    const result = await Account.deactivate(accountId, userId)
    expect(result.alreadyInactive).toBe(true)
  })
})

describe('Account.reactivate', () => {
  let userId

  beforeEach(async () => {
    await resetTestDb()
    userId = await createTestUser()
  })

  it('flips an inactive account back to active without re-enabling planned transactions', async () => {
    const accountId = await createTestAccount(userId)
    const db = getTestDb()
    await db('planned_transactions').insert({
      id: 'pt-react-1',
      user_id: userId,
      account_id: accountId,
      amount: -10,
      description: 'PT to stay paused',
      type: 'expense',
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      is_active: true,
    })
    await Account.deactivate(accountId, userId)

    const result = await Account.reactivate(accountId, userId)
    expect(result.reactivated).toBe(true)
    expect(result.alreadyActive).toBe(false)

    const account = await db('accounts').where('id', accountId).first()
    expect(account.is_active).toBeTruthy()
    const pt = await db('planned_transactions').where('id', 'pt-react-1').first()
    expect(pt.is_active).toBeFalsy()
  })

  it('is idempotent on an already active account', async () => {
    const accountId = await createTestAccount(userId)
    const result = await Account.reactivate(accountId, userId)
    expect(result.alreadyActive).toBe(true)
  })
})

describe('Account.format', () => {
  it('formats database row to API response', () => {
    const dbRow = {
      id: 'test-id',
      user_id: 'user-id',
      name: 'Test Account',
      type: 'checking',
      institution: 'My Bank',
      account_number: '1234',
      initial_balance: 1000,
      current_balance: 1500,
      currency: 'EUR',
      color: '#3B82F6',
      icon: 'wallet',
      is_active: 1,
      is_included_in_total: 1,
      notes: 'Some notes',
      sort_order: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-15',
    }

    const formatted = Account.format(dbRow)

    expect(formatted.id).toBe('test-id')
    expect(formatted.userId).toBe('user-id')
    expect(formatted.name).toBe('Test Account')
    expect(formatted.type).toBe('checking')
    expect(formatted.institution).toBe('My Bank')
    expect(formatted.accountNumber).toBe('1234')
    expect(formatted.initialBalance).toBe(1000)
    expect(formatted.currentBalance).toBe(1500)
    expect(formatted.currency).toBe('EUR')
    expect(formatted.color).toBe('#3B82F6')
    expect(formatted.icon).toBe('wallet')
    expect(formatted.isActive).toBe(true)
    expect(formatted.isIncludedInTotal).toBe(true)
    expect(formatted.notes).toBe('Some notes')
    expect(formatted.sortOrder).toBe(0)
    expect(formatted.createdAt).toBe('2026-01-01')
    expect(formatted.updatedAt).toBe('2026-01-15')
  })

  it('converts boolean fields correctly', () => {
    const dbRow = {
      id: 'test',
      is_active: 0,
      is_included_in_total: 0,
    }

    const formatted = Account.format(dbRow)

    expect(formatted.isActive).toBe(false)
    expect(formatted.isIncludedInTotal).toBe(false)
  })
})
