import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import knex from '../database/connection.js';
import config from '../config/index.js';
import User from './User.js';
import { generateId } from '../utils/helpers.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const defaultsForLocale = (locale) => locale === 'pt'
  ? { decimalSeparator: ',', digitGrouping: '.' }
  : locale === 'fr'
    ? { decimalSeparator: ',', digitGrouping: ' ' }
    : { decimalSeparator: '.', digitGrouping: ',' };

const format = (workspace, role, active = false) => ({
  id: workspace.id,
  name: workspace.name,
  currency: workspace.currency,
  locale: workspace.locale,
  decimalSeparator: workspace.decimal_separator,
  digitGrouping: workspace.digit_grouping,
  isPersonal: Boolean(workspace.is_personal),
  isActive: Boolean(workspace.is_active),
  notes: workspace.notes || '',
  role,
  active,
});

export default class ClientWorkspace {
  static async ensurePersonal(userId) {
    let workspace = await knex('client_workspaces')
      .where({ data_user_id: userId, is_personal: true })
      .first();
    if (workspace) return workspace;

    const user = await knex('users')
      .select('locale', 'currency', 'decimal_separator', 'digit_grouping')
      .where({ id: userId, is_workspace_identity: false })
      .first();
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');

    const id = generateId();
    try {
      await knex.transaction(async (trx) => {
        const existing = await trx('client_workspaces')
          .where({ data_user_id: userId, is_personal: true })
          .first();
        if (existing) return;

        await trx('client_workspaces').insert({
          id,
          name: 'Personal',
          data_user_id: userId,
          created_by: userId,
          currency: user.currency || 'EUR',
          locale: user.locale || 'fr',
          decimal_separator: user.decimal_separator || ',',
          digit_grouping: user.digit_grouping ?? ' ',
          is_personal: true,
        });
        await trx('client_workspace_members').insert({
          id: generateId(), workspace_id: id, user_id: userId, role: 'owner',
        });
      });
    } catch (error) {
      const createdByConcurrentRequest = await knex('client_workspaces')
        .where({ data_user_id: userId, is_personal: true })
        .first();
      if (!createdByConcurrentRequest) throw error;
    }

    return knex('client_workspaces').where({ data_user_id: userId, is_personal: true }).first();
  }

  static async create(userId, data) {
    const workspaceId = generateId();
    const dataUserId = generateId();
    const locale = data.locale || 'pt';
    const currency = data.currency || (locale === 'pt' ? 'BRL' : 'EUR');
    const localeDefaults = defaultsForLocale(locale);
    const decimalSeparator = data.decimalSeparator || localeDefaults.decimalSeparator;
    const digitGrouping = data.digitGrouping ?? localeDefaults.digitGrouping;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), config.security.bcryptRounds);

    await knex.transaction(async (trx) => {
      await trx('users').insert({
        id: dataUserId,
        email: `workspace-${dataUserId}@workspace.budgetos.internal`,
        password_hash: passwordHash,
        first_name: data.name,
        role: 'user',
        locale,
        currency,
        decimal_separator: decimalSeparator,
        digit_grouping: digitGrouping,
        is_workspace_identity: true,
      });
      await User._insertDefaults(trx, dataUserId, locale);
      await trx('client_workspaces').insert({
        id: workspaceId,
        name: data.name,
        data_user_id: dataUserId,
        created_by: userId,
        currency,
        locale,
        decimal_separator: decimalSeparator,
        digit_grouping: digitGrouping,
        notes: data.notes?.trim() || null,
      });
      await trx('client_workspace_members').insert({
        id: generateId(), workspace_id: workspaceId, user_id: userId, role: 'owner',
      });
    });

    return ClientWorkspace.findAccessible(workspaceId, userId);
  }

  static async findAllForUser(userId, activeId = null) {
    const workspaces = await knex('client_workspaces as w')
      .join('client_workspace_members as m', 'm.workspace_id', 'w.id')
      .where('m.user_id', userId)
      .select('w.*', 'm.role')
      .orderBy('w.is_personal', 'desc')
      .orderBy('w.name', 'asc');
    return workspaces.map((workspace) => format(workspace, workspace.role, workspace.id === activeId));
  }

  static async findAccessible(id, userId) {
    if (!id) return null;
    const workspace = await knex('client_workspaces as w')
      .join('client_workspace_members as m', 'm.workspace_id', 'w.id')
      .where({ 'w.id': id, 'm.user_id': userId, 'w.is_active': true })
      .select('w.*', 'm.role')
      .first();
    return workspace ? format(workspace, workspace.role) : null;
  }

  static async getOwnedOrFail(id, userId) {
    const workspace = await knex('client_workspaces as w')
      .join('client_workspace_members as m', 'm.workspace_id', 'w.id')
      .where({ 'w.id': id, 'm.user_id': userId, 'm.role': 'owner', 'w.is_personal': false })
      .select('w.*', 'm.role')
      .first();
    if (!workspace) throw new ForbiddenError('Workspace management denied', 'WORKSPACE_FORBIDDEN');
    return { ...format(workspace, workspace.role), dataUserId: workspace.data_user_id };
  }

  static async setActive(id, userId, isActive) {
    await ClientWorkspace.getOwnedOrFail(id, userId);
    await knex('client_workspaces').where({ id }).update({ is_active: isActive, updated_at: knex.fn.now() });
    return ClientWorkspace.getOwnedOrFail(id, userId);
  }

  static async updateNotes(id, userId, notes) {
    await ClientWorkspace.getOwnedOrFail(id, userId);
    await knex('client_workspaces').where({ id }).update({
      notes: notes?.trim() || null,
      updated_at: knex.fn.now(),
    });
    return ClientWorkspace.getOwnedOrFail(id, userId);
  }

  static async delete(id, userId) {
    const workspace = await ClientWorkspace.getOwnedOrFail(id, userId);
    await knex.transaction(async (trx) => {
      await trx('client_workspaces').where({ id }).del();
      await trx('users').where({ id: workspace.dataUserId, is_workspace_identity: true }).del();
    });
  }

  static async getAccessibleOrFail(id, userId) {
    const workspace = await ClientWorkspace.findAccessible(id, userId);
    if (!workspace) throw new ForbiddenError('Workspace access denied', 'WORKSPACE_FORBIDDEN');
    const row = await knex('client_workspaces').where('id', id).first();
    return { ...workspace, dataUserId: row.data_user_id };
  }

  static async resolveContext(id, userId) {
    if (!id) return null;
    return ClientWorkspace.getAccessibleOrFail(id, userId);
  }
}
