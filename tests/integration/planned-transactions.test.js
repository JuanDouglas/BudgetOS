/**
 * Integration tests for /api/v1/planned-transactions endpoints
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

  const accRes = await agent
    .post('/api/v1/accounts')
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'Planning Account', type: 'checking', initialBalance: 3000 })
  accountId = accRes.body.data.account.id
})

const makePlanned = (overrides = {}) => ({
  accountId,
  amount: -50,
  description: 'Monthly Rent',
  type: 'expense',
  frequency: 'monthly',
  startDate: '2026-02-01',
  ...overrides,
})

describe('Planned Transactions - CRUD', () => {
  it('should create a planned transaction', async () => {
    const res = await agent
      .post('/api/v1/planned-transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makePlanned())

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.plannedTransaction.description).toBe('Monthly Rent')
  })

  it('should list planned transactions', async () => {
    await agent.post('/api/v1/planned-transactions').set('X-CSRF-Token', csrfToken).send(makePlanned())

    const res = await agent.get('/api/v1/planned-transactions')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // data is a direct array for list endpoints
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('should get a single planned transaction', async () => {
    const createRes = await agent.post('/api/v1/planned-transactions').set('X-CSRF-Token', csrfToken).send(makePlanned())
    const id = createRes.body.data.plannedTransaction.id

    const res = await agent.get(`/api/v1/planned-transactions/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.plannedTransaction.id).toBe(id)
  })

  it('should update a planned transaction', async () => {
    const createRes = await agent.post('/api/v1/planned-transactions').set('X-CSRF-Token', csrfToken).send(makePlanned())
    const id = createRes.body.data.plannedTransaction.id

    const res = await agent
      .put(`/api/v1/planned-transactions/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ description: 'Updated Rent' })

    expect(res.status).toBe(200)
    expect(res.body.data.plannedTransaction.description).toBe('Updated Rent')
  })

  it('should delete a planned transaction', async () => {
    const createRes = await agent.post('/api/v1/planned-transactions').set('X-CSRF-Token', csrfToken).send(makePlanned())
    const id = createRes.body.data.plannedTransaction.id

    const res = await agent.delete(`/api/v1/planned-transactions/${id}`).set('X-CSRF-Token', csrfToken)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('Planned Transactions - Upcoming', () => {
  it('should list upcoming planned transactions', async () => {
    await agent.post('/api/v1/planned-transactions').set('X-CSRF-Token', csrfToken).send(makePlanned())

    const res = await agent.get('/api/v1/planned-transactions/upcoming')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.upcoming).toBeDefined()
  })
})

describe('Planned Transactions - Occurrence', () => {
  it('should create an occurrence from a planned transaction', async () => {
    const createRes = await agent.post('/api/v1/planned-transactions').set('X-CSRF-Token', csrfToken).send(makePlanned())
    const id = createRes.body.data.plannedTransaction.id

    const res = await agent
      .post(`/api/v1/planned-transactions/${id}/occurrence`)
      .set('X-CSRF-Token', csrfToken)
      .send({ date: '2026-02-01' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })

  it('reconciles a past planned transfer without exhausting the SQLite pool', async () => {
    const destinationResponse = await agent
      .post('/api/v1/accounts')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Transfer destination', type: 'savings' })
    const destinationAccountId = destinationResponse.body.data.account.id
    const plannedResponse = await agent
      .post('/api/v1/planned-transactions')
      .set('X-CSRF-Token', csrfToken)
      .send(makePlanned({
        type: 'transfer',
        amount: 25,
        description: 'Scheduled transfer',
        frequency: 'once',
        startDate: '2026-10-01',
        toAccountId: destinationAccountId,
      }))
    const plannedId = plannedResponse.body.data.plannedTransaction.id

    const response = await agent
      .post(`/api/v1/planned-transactions/${plannedId}/reconcile`)
      .set('X-CSRF-Token', csrfToken)

    expect(response.status).toBe(200)
    expect(response.body.data.created).toBe(1)
    const transactions = await agent.get(`/api/v1/transactions?search=Scheduled%20transfer`)
    expect(transactions.body.data).toHaveLength(2)
  })
})

describe('Planned Transactions - Validation', () => {
  it('should reject planned transaction without frequency', async () => {
    const res = await agent
      .post('/api/v1/planned-transactions')
      .set('X-CSRF-Token', csrfToken)
      .send({ accountId, amount: -50, description: 'No Freq', type: 'expense', startDate: '2026-02-01' })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
