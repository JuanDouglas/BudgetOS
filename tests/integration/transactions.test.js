/**
 * Integration tests for /api/v1/transactions endpoints
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, createAuthenticatedAgent, setupTestDb, closeTestDb, resetTestDb } from './helpers.js'

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

  // Create an account for transactions
  const accRes = await agent
    .post('/api/v1/accounts')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Main Account', type: 'checking', initialBalance: 5000 })
  accountId = accRes.body.data.account.id
})

const makeTx = (overrides = {}) => ({
  accountId,
  amount: -50,
  description: 'Test Transaction',
  date: '2026-01-15',
  type: 'expense',
  ...overrides,
})

describe('Transactions - CRUD', () => {
  it('should create a transaction', async () => {
    const res = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx())

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.transaction.description).toBe('Test Transaction')
  })

  it('should list transactions', async () => {
    await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx({ description: 'Second Tx', amount: -75 }))

    const res = await agent.get('/api/v1/transactions')
    expect(res.status).toBe(200)
    // data is a direct array for list endpoints
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
  })

  it('should get a single transaction', async () => {
    const createRes = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    const id = createRes.body.data.transaction.id

    const res = await agent.get(`/api/v1/transactions/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.transaction.id).toBe(id)
  })

  it('should update a transaction', async () => {
    const createRes = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    const id = createRes.body.data.transaction.id

    const res = await agent
      .put(`/api/v1/transactions/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ description: 'Updated Transaction' })

    expect(res.status).toBe(200)
    expect(res.body.data.transaction.description).toBe('Updated Transaction')
  })

  it('should delete a transaction', async () => {
    const createRes = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    const id = createRes.body.data.transaction.id

    const res = await agent.delete(`/api/v1/transactions/${id}`).set('X-CSRF-Token', csrfToken)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('Credit card installments', () => {
  async function createDeferredCard() {
    const response = await agent
      .post('/api/v1/credit-cards')
      .set('X-CSRF-Token', csrfToken)
      .send({
        accountId,
        name: 'Installment card',
        expirationDate: '12/29',
        debitType: 'deferred',
        cycleStartDay: 1,
        debitDay: 10,
      })
    expect(response.status).toBe(201)
    return response.body.data.creditCard
  }

  it('creates monthly installment transactions totaling the exact purchase amount', async () => {
    const card = await createDeferredCard()
    const purchaseDate = '2026-09-15'
    const response = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx({
        amount: 100.01,
        description: 'Parcelled purchase',
        date: purchaseDate,
        creditCardId: card.id,
        installmentCount: 3,
      }))

    expect(response.status).toBe(201)
    expect(response.body.data.transaction.installmentCount).toBe(3)

    const listResponse = await agent.get(`/api/v1/transactions?creditCardId=${card.id}&limit=100`)
    expect(listResponse.status).toBe(200)
    const installments = listResponse.body.data
    expect(installments).toHaveLength(3)
    expect(installments.map((item) => item.installmentNumber).sort()).toEqual([1, 2, 3])
    expect(new Set(installments.map((item) => item.date))).toEqual(new Set([
      '2026-09-15', '2026-10-15', '2026-11-15',
    ]))
    expect(installments.every((item) => item.creditCardCycleId)).toBe(true)
    expect(new Set(installments.map((item) => item.creditCardCycleId)).size).toBe(3)
    expect(installments.reduce((sum, item) => sum + Math.abs(item.amount), 0)).toBeCloseTo(100.01, 2)
  })

  it('refreshes the current card cycle total immediately after a purchase', async () => {
    const card = await createDeferredCard()
    const today = new Date()
    const purchaseDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const response = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx({ amount: 73.42, date: purchaseDate, creditCardId: card.id }))

    expect(response.status).toBe(201)
    expect(response.body.data.transaction.creditCardCycleId).toBeTruthy()

    const cards = await agent.get('/api/v1/credit-cards')
    const updatedCard = cards.body.data.creditCards.find((item) => item.id === card.id)
    expect(updatedCard.currentCycle.totalAmount).toBe(73.42)
    expect(updatedCard.currentCycle.transactions).toHaveLength(1)
  })

  it('rejects installments without a deferred credit card', async () => {
    const response = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx({ installmentCount: 2 }))

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INSTALLMENTS_REQUIRE_CREDIT_CARD')
  })
})

describe('Transactions - Split', () => {
  it('should create a split transaction', async () => {
    const res = await agent
      .post('/api/v1/transactions/split')
      .set('X-CSRF-Token', csrfToken)
      .send({
        accountId,
        amount: -100,
        description: 'Split Tx',
        date: '2026-01-15',
        type: 'expense',
        splits: [
          { categoryId: null, amount: -60, description: 'Part 1' },
          { categoryId: null, amount: -40, description: 'Part 2' },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })
})

describe('Transactions - Reconcile', () => {
  it('should toggle reconcile on a transaction', async () => {
    const createRes = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    const id = createRes.body.data.transaction.id

    const res = await agent
      .patch(`/api/v1/transactions/${id}/reconcile`)
      .set('X-CSRF-Token', csrfToken)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('should reconcile multiple transactions', async () => {
    const tx1 = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    const tx2 = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx({ description: 'Tx2', amount: -30 }))

    const res = await agent
      .post('/api/v1/transactions/reconcile')
      .set('X-CSRF-Token', csrfToken)
      .send({
        transactionIds: [tx1.body.data.transaction.id, tx2.body.data.transaction.id],
        reconcileDate: '2026-01-20',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('Transactions - Match', () => {
  it('should find matching transactions', async () => {
    await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx({ amount: -123.45 }))

    // Match requires accountId and amount
    const res = await agent.get(`/api/v1/transactions/match?accountId=${accountId}&amount=-123.45&date=2026-01-15`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.matches).toBeDefined()
  })
})

describe('Transactions - Pagination', () => {
  it('should paginate results', async () => {
    // Create several transactions
    for (let i = 0; i < 5; i++) {
      await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx({ description: `Tx ${i}`, amount: -(i + 1) * 10 }))
    }

    const res = await agent.get('/api/v1/transactions?page=1&limit=2')
    expect(res.status).toBe(200)
    // data is a direct array
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeLessThanOrEqual(2)
    expect(res.body.pagination).toBeDefined()
  })

  it('should filter by accountId', async () => {
    await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())

    const res = await agent.get(`/api/v1/transactions?accountId=${accountId}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Transactions - Check Number', () => {
  it('should create a transaction with checkNumber', async () => {
    const res = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx({ checkNumber: 'CHK-001' }))

    expect(res.status).toBe(201)
    expect(res.body.data.transaction.checkNumber).toBe('CHK-001')
  })

  it('should update checkNumber on a transaction', async () => {
    const createRes = await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken).send(makeTx())
    const id = createRes.body.data.transaction.id

    const res = await agent
      .put(`/api/v1/transactions/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ checkNumber: 'CHK-UPD' })

    expect(res.status).toBe(200)
    expect(res.body.data.transaction.checkNumber).toBe('CHK-UPD')
  })

  it('should return checkNumber in GET response', async () => {
    const createRes = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx({ checkNumber: 'CHK-GET' }))
    const id = createRes.body.data.transaction.id

    const res = await agent.get(`/api/v1/transactions/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.transaction.checkNumber).toBe('CHK-GET')
  })

  it('should find transactions by searching checkNumber', async () => {
    await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken)
      .send(makeTx({ description: 'Check payment', checkNumber: 'CHK-9876' }))
    await agent.post('/api/v1/transactions').set('X-CSRF-Token', csrfToken)
      .send(makeTx({ description: 'Card payment' }))

    const res = await agent.get('/api/v1/transactions?search=9876')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].checkNumber).toBe('CHK-9876')
  })
})

describe('Transactions - Validation', () => {
  it('should reject transaction without description', async () => {
    const res = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send({ accountId, amount: -10, date: '2026-01-15', type: 'expense' })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('should reject transaction with zero amount', async () => {
    const res = await agent
      .post('/api/v1/transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makeTx({ amount: 0 }))

    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
