import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestApp, createAuthenticatedAgent, getTestDb, seedSystemSettings } from './helpers.js'

// Use dates in next month so projected occurrences (computed from
// startDate >= today) fall inside the test window regardless of when
// the suite runs.
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = new Date(); today.setHours(0, 0, 0, 0)
const periodStart = fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 1))
const periodEnd = fmtDate(new Date(today.getFullYear(), today.getMonth() + 2, 0))
const actualDate = fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 10))
const rentStart = fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 1))
const interestStart = fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 15))
// Past month for the dedup test
const dedupStart = fmtDate(new Date(today.getFullYear(), today.getMonth() - 2, 15))
const dedupPeriodStart = fmtDate(new Date(today.getFullYear(), today.getMonth() - 2, 1))
const dedupPeriodEnd = fmtDate(new Date(today.getFullYear(), today.getMonth() - 2 + 1, 0))

describe('Forecast Transactions API', () => {
  let app, agent, csrfToken, accountId, account2Id

  beforeAll(async () => {
    app = await createTestApp()
    await seedSystemSettings()
    const auth = await createAuthenticatedAgent(app)
    agent = auth.agent
    csrfToken = auth.csrfToken
    const database = getTestDb()

    // Create two accounts
    const res1 = await agent.post('/api/v1/accounts')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Forecast Account', type: 'checking', initialBalance: 5000 })
    accountId = res1.body.data.account.id

    const res2 = await agent.post('/api/v1/accounts')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Savings', type: 'savings', initialBalance: 10000 })
    account2Id = res2.body.data.account.id

    await database('credit_cards').insert({
      id: 'forecast-deferred-card',
      user_id: auth.user.id,
      account_id: accountId,
      linked_account_id: accountId,
      name: 'Corporate Visa',
      debit_type: 'deferred',
      is_active: true,
    })
    await database('credit_card_cycles').insert({
      id: 'forecast-deferred-cycle',
      credit_card_id: 'forecast-deferred-card',
      cycle_start_date: periodStart,
      cycle_end_date: periodEnd,
      debit_date: periodStart,
      total_amount: 735.25,
      status: 'pending',
    })

    // Create an actual transaction in the period
    await agent.post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send({ accountId, amount: 85, description: 'Groceries', type: 'expense', date: actualDate })

    // Create a planned transaction that will generate a projected occurrence in the period
    await agent.post('/api/v1/planned-transactions')
      .set('X-CSRF-Token', csrfToken)
      .send({ accountId, amount: -200, description: 'Rent', type: 'expense', frequency: 'monthly', startDate: rentStart })

    // Create a planned transaction on second account
    await agent.post('/api/v1/planned-transactions')
      .set('X-CSRF-Token', csrfToken)
      .send({ accountId: account2Id, amount: 500, description: 'Interest', type: 'income', frequency: 'monthly', startDate: interestStart })
  })

  afterAll(async () => {
    await app?.close?.()
  })

  it('should return both actual and projected transactions for a period', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: periodStart, endDate: periodEnd })

    expect(res.status).toBe(200)
    expect(res.body.data.data.length).toBeGreaterThan(0)
    expect(res.body.data.counts.actual).toBeGreaterThanOrEqual(1)
    expect(res.body.data.counts.projected).toBeGreaterThanOrEqual(1)

    // Verify source field
    const sources = new Set(res.body.data.data.map(tx => tx.source))
    expect(sources.has('actual')).toBe(true)
    expect(sources.has('projected')).toBe(true)
  })

  it('includes deferred card debits in projected cash flow', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: periodStart, endDate: periodEnd })

    const cardDebit = res.body.data.data.find((tx) => tx.sourceType === 'card_debit')
    expect(cardDebit).toMatchObject({
      date: periodStart,
      amount: -735.25,
      description: 'Fatura de cartão: Corporate Visa',
      type: 'expense',
      source: 'projected',
      accountId,
    })
  })

  it('should filter by accountId', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: periodStart, endDate: periodEnd, accountId })

    expect(res.status).toBe(200)
    // All results should be for the specified account
    for (const tx of res.body.data.data) {
      expect(tx.accountId).toBe(accountId)
    }

    // Should not include Interest (account2)
    const descriptions = res.body.data.data.map(tx => tx.description)
    expect(descriptions).not.toContain('Interest')
  })

  it('should filter by type', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: periodStart, endDate: periodEnd, type: 'income' })

    expect(res.status).toBe(200)
    for (const tx of res.body.data.data) {
      expect(tx.type).toBe('income')
    }
  })

  it('should filter by search', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: periodStart, endDate: periodEnd, search: 'Rent' })

    expect(res.status).toBe(200)
    for (const tx of res.body.data.data) {
      expect(tx.description.toLowerCase()).toContain('rent')
    }
  })

  it('should deduplicate projected when actual recurring exists', async () => {
    // Create a planned tx starting March 15 (monthly)
    const ptRes = await agent.post('/api/v1/planned-transactions')
      .set('X-CSRF-Token', csrfToken)
      .send({ accountId, amount: -100, description: 'Dedup Test', type: 'expense', frequency: 'monthly', startDate: dedupStart })
    const ptId = ptRes.body.data.plannedTransaction.id

    // Reconcile to create a transaction on March 15
    await agent.post(`/api/v1/planned-transactions/${ptId}/reconcile`)
      .set('X-CSRF-Token', csrfToken).send({})

    // Forecast for March: should NOT have both actual + projected for Dedup Test
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: dedupPeriodStart, endDate: dedupPeriodEnd, search: 'Dedup' })

    const dedupTxs = res.body.data.data.filter(tx => tx.description === 'Dedup Test')
    // Should have exactly 1 (actual), not 2 (actual + projected)
    expect(dedupTxs.length).toBe(1)
    expect(dedupTxs[0].source).toBe('actual')

    // Cleanup
    await agent.delete(`/api/v1/planned-transactions/${ptId}`)
      .set('X-CSRF-Token', csrfToken)
  })

  it('should default to current month when no dates provided', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')

    expect(res.status).toBe(200)
    expect(res.body.data.period.startDate).toBeTruthy()
    expect(res.body.data.period.endDate).toBeTruthy()
  })

  it('should return sorted by date ascending', async () => {
    const res = await agent.get('/api/v1/reports/forecast/transactions')
      .query({ startDate: periodStart, endDate: periodEnd })

    const dates = res.body.data.data.map(tx => tx.date)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true)
    }
  })
})
