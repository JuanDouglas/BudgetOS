import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import {
  closeTestDb,
  createAuthenticatedAgent,
  createTestApp,
  getTestDb,
  resetTestDb,
  seedSystemSettings,
} from './helpers.js';

let app;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  await seedSystemSettings();
});

describe('Client workspaces', () => {
  it('keeps client finance data isolated while preserving the signed-in user', async () => {
    const { agent, user } = await createAuthenticatedAgent(app);
    const listResponse = await agent.get('/api/v1/workspaces');
    expect(listResponse.status).toBe(200);
    const personal = listResponse.body.data.activeWorkspace;
    expect(personal.isPersonal).toBe(true);
    const csrfToken = (await agent.get('/api/v1/csrf-token')).body.csrfToken

    const createResponse = await agent
      .post('/api/v1/workspaces')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Cliente Alfa', locale: 'pt', currency: 'BRL' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.workspace.currency).toBe('BRL');
    expect(createResponse.body.data.workspace.locale).toBe('pt');
    const client = createResponse.body.data.workspace;
    const database = getTestDb();
    const clientRecord = await database('client_workspaces').where('id', client.id).first();

    expect(clientRecord.data_user_id).not.toBe(user.id);
    expect(clientRecord.digit_grouping).toBe('.');
    const internalUser = await database('users').where('id', clientRecord.data_user_id).first();
    expect(internalUser.is_workspace_identity).toBe(true);

    const accountResponse = await agent
      .post('/api/v1/accounts')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Conta operacional', type: 'checking', currency: 'BRL' });
    expect(accountResponse.status).toBe(201);

    const clientAccounts = await agent.get('/api/v1/accounts');
    expect(clientAccounts.body.data).toHaveLength(1);

    const personalActivation = await agent
      .post(`/api/v1/workspaces/${personal.id}/activate`)
      .set('X-CSRF-Token', csrfToken);
    expect(personalActivation.status).toBe(200);
    const personalAccounts = await agent.get('/api/v1/accounts');
    expect(personalAccounts.body.data).toHaveLength(0);

    const profileResponse = await agent.get('/api/v1/auth/me');
    expect(profileResponse.body.data.user.id).toBe(user.id);
  });

  it('does not allow another user to activate a client workspace', async () => {
    const owner = await createAuthenticatedAgent(app, { email: 'owner@example.com' });
    const csrf = (await owner.agent.get('/api/v1/csrf-token')).body.csrfToken;
    const createResponse = await owner.agent
      .post('/api/v1/workspaces')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Cliente Restrito', locale: 'pt', currency: 'BRL' });
    const workspaceId = createResponse.body.data.workspace.id;
    const database = getTestDb();
    const clientRecord = await database('client_workspaces').where('id', workspaceId).first();
    const internalUser = await database('users').where('id', clientRecord.data_user_id).first();

    const otherUser = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    const otherCsrf = (await otherUser.agent.get('/api/v1/csrf-token')).body.csrfToken;
    const response = await otherUser.agent
      .post(`/api/v1/workspaces/${workspaceId}/activate`)
      .set('X-CSRF-Token', otherCsrf);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('WORKSPACE_FORBIDDEN');

    const forgedContext = await otherUser.agent
      .get('/api/v1/accounts')
      .set('X-Workspace-ID', workspaceId);
    expect(forgedContext.status).toBe(403);
    expect(forgedContext.body.error.code).toBe('WORKSPACE_FORBIDDEN');

    const anonymous = supertest.agent(app);
    const anonymousCsrf = (await anonymous.get('/api/v1/csrf-token')).body.csrfToken;
    const fakeLogin = await anonymous
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', anonymousCsrf)
      .send({ email: internalUser.email, password: 'anything' });
    expect(fakeLogin.status).toBe(401);
  });
});
