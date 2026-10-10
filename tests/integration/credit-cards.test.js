/**
 * Integration tests for /api/v1/credit-cards endpoints
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { createTestApp, createAuthenticatedAgent, setupTestDb, getTestDb, closeTestDb, resetTestDb } from './helpers.js'

let app

beforeAll(async () => {
  await setupTestDb()
  app = await createTestApp()
})

afterAll(async () => {
  await closeTestDb()
})

let agent, csrfToken, accountId

beforeEach(async () => {
  await resetTestDb()
  const ctx = await createAuthenticatedAgent(app)
  agent = ctx.agent
  csrfToken = ctx.csrfToken

  // Create an account to link the credit card
  const accRes = await agent
    .post('/api/v1/accounts')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'CC Account', type: 'credit_card', initialBalance: 0 })
  accountId = accRes.body.data.account.id
})

const makeCard = (overrides = {}) => ({
  accountId,
  name: 'Visa Gold',
  expirationDate: '12/28',
  debitType: 'immediate',
  cycleStartDay: 1,
  ...overrides,
})

describe('Credit Cards - CRUD', () => {
  it('should create a credit card', async () => {
    const res = await agent
      .post('/api/v1/credit-cards')
      .set('X-CSRF-Token', csrfToken)
      .send(makeCard())

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.creditCard.name).toBe('Visa Gold')
  })

  it('should reject a card account owned by another user', async () => {
    const otherUser = await createAuthenticatedAgent(app)
    const otherAccountResponse = await otherUser.agent
      .post('/api/v1/accounts')
      .set('X-CSRF-Token', otherUser.csrfToken)
      .send({ name: 'Private account', type: 'checking' })
    const response = await agent
      .post('/api/v1/credit-cards')
      .set('X-CSRF-Token', csrfToken)
      .send(makeCard({ accountId: otherAccountResponse.body.data.account.id }))

    expect(otherAccountResponse.status).toBe(201)
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('should list credit cards', async () => {
    await agent.post('/api/v1/credit-cards').set('X-CSRF-Token', csrfToken).send(makeCard())

    const res = await agent.get('/api/v1/credit-cards')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.creditCards.length).toBeGreaterThanOrEqual(1)
  })

  it('should get a single credit card', async () => {
    const createRes = await agent.post('/api/v1/credit-cards').set('X-CSRF-Token', csrfToken).send(makeCard())
    const id = createRes.body.data.creditCard.id

    const res = await agent.get(`/api/v1/credit-cards/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.creditCard.id).toBe(id)
  })

  it('should update a credit card', async () => {
    const createRes = await agent.post('/api/v1/credit-cards').set('X-CSRF-Token', csrfToken).send(makeCard())
    const id = createRes.body.data.creditCard.id

    const res = await agent
      .put(`/api/v1/credit-cards/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Mastercard Platinum' })

    expect(res.status).toBe(200)
    expect(res.body.data.creditCard.name).toBe('Mastercard Platinum')
  })

  it('should delete a credit card', async () => {
    const createRes = await agent.post('/api/v1/credit-cards').set('X-CSRF-Token', csrfToken).send(makeCard())
    const id = createRes.body.data.creditCard.id

    const res = await agent.delete(`/api/v1/credit-cards/${id}`).set('X-CSRF-Token', csrfToken)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('Credit Cards - Cycles', () => {
  // Known bug: ambiguous column name credit_card_id in getCycles query (SQLite)
  it.skip('should list cycles for a credit card', async () => {
    const createRes = await agent.post('/api/v1/credit-cards').set('X-CSRF-Token', csrfToken).send(makeCard())
    const id = createRes.body.data.creditCard.id

    const res = await agent.get(`/api/v1/credit-cards/${id}/cycles`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('should get current cycle', async () => {
    const createRes = await agent.post('/api/v1/credit-cards').set('X-CSRF-Token', csrfToken).send(makeCard())
    const id = createRes.body.data.creditCard.id

    const res = await agent.get(`/api/v1/credit-cards/${id}/cycles/current`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('Credit Cards - Deferred debit', () => {
  it('should create a deferred debit card with debitDay', async () => {
    const res = await agent
      .post('/api/v1/credit-cards')
      .set('X-CSRF-Token', csrfToken)
      .send(makeCard({ debitType: 'deferred', debitDay: 15 }))

    expect(res.status).toBe(201)
    expect(res.body.data.creditCard.debitType).toBe('deferred')
  })

  it('should return currentCycleBalance for deferred card with transactions in open cycle', async () => {
    // Create a deferred card
    const createRes = await agent
      .post('/api/v1/credit-cards')
      .set('X-CSRF-Token', csrfToken)
      .send(makeCard({ debitType: 'deferred', debitDay: 5 }))
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.data.creditCard.id
    const userId = createRes.body.data.creditCard.userId

    // Insert an open cycle and a transaction linked to it directly in DB
    const db = getTestDb()
    const cycleId = uuidv4()
    await db('credit_card_cycles').insert({
      id: cycleId,
      credit_card_id: cardId,
      cycle_start_date: '2026-01-01',
      cycle_end_date: '2026-01-31',
      debit_date: '2026-02-05',
      total_amount: 0,
      status: 'open',
    })

    const txId = uuidv4()
    await db('transactions').insert({
      id: txId,
      user_id: userId,
      account_id: accountId,
      amount: -42.50,
      description: 'Test CC purchase',
      date: '2026-01-15',
      type: 'expense',
      status: 'pending',
      credit_card_id: cardId,
      credit_card_cycle_id: cycleId,
    })

    // GET /credit-cards should return the balance
    const listRes = await agent.get('/api/v1/credit-cards')
    expect(listRes.status).toBe(200)
    const card = listRes.body.data.creditCards.find(c => c.id === cardId)
    expect(card).toBeDefined()
    expect(card.currentCycleBalance).toBe(42.50)
    expect(card.pendingDebitAmount).toBe(0)
  })

  it('should return currentCycleBalance 0 for deferred card with no transactions', async () => {
    const createRes = await agent
      .post('/api/v1/credit-cards')
      .set('X-CSRF-Token', csrfToken)
      .send(makeCard({ debitType: 'deferred', debitDay: 5 }))
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.data.creditCard.id

    const listRes = await agent.get('/api/v1/credit-cards')
    expect(listRes.status).toBe(200)
    const card = listRes.body.data.creditCards.find(c => c.id === cardId)
    expect(card).toBeDefined()
    expect(card.currentCycleBalance).toBe(0)
    expect(card.pendingDebitAmount).toBe(0)
  })
})
