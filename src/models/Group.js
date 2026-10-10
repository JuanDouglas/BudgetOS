import knex from '../database/connection.js';
import { generateId } from '../utils/helpers.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { paginationMeta } from '../utils/modelHelpers.js';

/**
 * Group model for managing user groups and memberships
 */
export class Group {
  /**
   * Create a new group
   * @param {Object} data - Group data
   * @param {string} data.name - Group name
   * @param {string} [data.description] - Group description
   * @param {string} data.createdBy - ID of user creating the group
   * @returns {Promise<Object>}
   */
  static async create(data) {
    const { name, description, createdBy, defaultLocale, defaultDecimalSeparator, defaultDigitGrouping } = data;
    const id = generateId();

    const row = {
      id,
      name,
      description: description || null,
      is_active: true,
      created_by: createdBy,
    };
    row.default_locale = defaultLocale || 'pt';
    row.default_decimal_separator = defaultDecimalSeparator || ',';
    row.default_digit_grouping = defaultDigitGrouping ?? (row.default_locale === 'pt' ? '.' : ' ');

    await knex('groups').insert(row);

    return Group.findById(id);
  }

  /**
   * Find group by ID
   * @param {string} id - Group ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const group = await knex('groups').where('id', id).first();
    return group ? Group.format(group) : null;
  }

  /**
   * Find group by ID or throw 404
   * @param {string} id - Group ID
   * @returns {Promise<Object>}
   */
  static async findByIdOrFail(id) {
    const group = await Group.findById(id);
    if (!group) {
      throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
    }
    return group;
  }

  /**
   * List all groups with pagination and filters
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @param {string} [options.search] - Search by name
   * @param {boolean} [options.isActive] - Filter by active status
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  static async findAll(options = {}) {
    const { page = 1, limit = 50, search, isActive } = options;
    const offset = (page - 1) * limit;

    let query = knex('groups').select('groups.*');

    if (isActive !== undefined) {
      query = query.where('groups.is_active', isActive);
    }

    if (search) {
      query = query.where('groups.name', 'like', `%${search}%`);
    }

    // Run count and data queries in parallel; count reuses filters via clone
    const [groups, totalResult] = await Promise.all([
      query.clone().orderBy('groups.created_at', 'desc').limit(limit).offset(offset),
      query.clone().clearSelect().clearOrder().count('* as count').first(),
    ]);
    const total = totalResult?.count || 0;

    return {
      data: groups.map(Group.format),
      pagination: paginationMeta(page, limit, total),
    };
  }

  /**
   * Update a group
   * @param {string} id - Group ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>}
   */
  static async update(id, data) {
    await Group.findByIdOrFail(id);

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.defaultLocale !== undefined) updates.default_locale = data.defaultLocale;
    if (data.defaultDecimalSeparator !== undefined) updates.default_decimal_separator = data.defaultDecimalSeparator;
    if (data.defaultDigitGrouping !== undefined) updates.default_digit_grouping = data.defaultDigitGrouping;

    if (Object.keys(updates).length > 0) {
      await knex('groups').where('id', id).update(updates);
    }

    return Group.findById(id);
  }

  /**
   * Soft-delete a group (set is_active = false)
   * @param {string} id - Group ID
   * @returns {Promise<Object>}
   */
  static async deactivate(id) {
    await Group.findByIdOrFail(id);
    await knex('groups').where('id', id).update({ is_active: false });
    return Group.findById(id);
  }

  /**
   * Add a member to a group
   * @param {string} groupId
   * @param {string} userId
   * @param {string} [role='member'] - 'admin' or 'member'
   * @returns {Promise<Object>}
   */
  static async addMember(groupId, userId, role = 'member') {
    await Group.findByIdOrFail(groupId);

    // Check if user is already in this group
    const existing = await knex('group_members')
      .where({ group_id: groupId, user_id: userId })
      .first();

    if (existing) {
      throw new ConflictError('This user is already a member of this group', 'MEMBER_EXISTS');
    }

    // If role is 'member', check the user is not already member of another group
    if (role === 'member') {
      const userRole = await knex('users').where('id', userId).select('role').first();
      if (userRole && userRole.role === 'user') {
        const existingMembership = await knex('group_members')
          .where({ user_id: userId, role: 'member' })
          .first();
        if (existingMembership) {
          throw new BadRequestError('A user can only be a member of one group', 'SINGLE_GROUP_MEMBERSHIP');
        }
      }
    }

    const id = generateId();
    await knex('group_members').insert({
      id,
      group_id: groupId,
      user_id: userId,
      role,
    });

    return Group.findMemberById(id);
  }

  /**
   * Remove a member from a group
   * @param {string} groupId
   * @param {string} userId
   */
  static async removeMember(groupId, userId) {
    const member = await knex('group_members')
      .where({ group_id: groupId, user_id: userId })
      .first();

    if (!member) {
      throw new NotFoundError('Member not found in this group', 'MEMBER_NOT_FOUND');
    }

    await knex('group_members')
      .where({ group_id: groupId, user_id: userId })
      .del();
  }

  /**
   * Update a member's role in a group
   * @param {string} groupId
   * @param {string} userId
   * @param {string} role - 'admin' or 'member'
   * @returns {Promise<Object>}
   */
  static async updateMemberRole(groupId, userId, role) {
    const member = await knex('group_members')
      .where({ group_id: groupId, user_id: userId })
      .first();

    if (!member) {
      throw new NotFoundError('Member not found in this group', 'MEMBER_NOT_FOUND');
    }

    // If changing to 'member', verify user won't have two member roles
    if (role === 'member' && member.role !== 'member') {
      const userRole = await knex('users').where('id', userId).select('role').first();
      if (userRole && userRole.role === 'user') {
        const otherMembership = await knex('group_members')
          .where({ user_id: userId, role: 'member' })
          .whereNot({ group_id: groupId })
          .first();
        if (otherMembership) {
          throw new BadRequestError('A user can only be a member of one group', 'SINGLE_GROUP_MEMBERSHIP');
        }
      }
    }

    await knex('group_members')
      .where({ group_id: groupId, user_id: userId })
      .update({ role });

    return Group.findMemberById(member.id);
  }

  /**
   * List members of a group
   * @param {string} groupId
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @param {string} [options.role] - Filter by role
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  static async findMembers(groupId, options = {}) {
    const { page = 1, limit = 50, role } = options;
    const offset = (page - 1) * limit;

    let query = knex('group_members')
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.group_id', groupId)
      .select(
        'group_members.id',
        'group_members.group_id',
        'group_members.user_id',
        'group_members.role',
        'group_members.joined_at',
        'users.email',
        'users.first_name',
        'users.last_name',
        'users.is_active',
      );

    if (role) {
      query = query.where('group_members.role', role);
    }

    // Run count and data queries in parallel; count reuses filters via clone
    const [members, totalResult] = await Promise.all([
      query.clone().orderBy('group_members.joined_at', 'asc').limit(limit).offset(offset),
      query.clone().clearSelect().clearOrder().count('* as count').first(),
    ]);
    const total = totalResult?.count || 0;

    return {
      data: members.map(Group.formatMember),
      pagination: paginationMeta(page, limit, total),
    };
  }

  /**
   * Find groups for a given user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async findByUser(userId) {
    const memberships = await knex('group_members')
      .join('groups', 'group_members.group_id', 'groups.id')
      .where('group_members.user_id', userId)
      .select(
        'groups.*',
        'group_members.role as member_role',
        'group_members.joined_at',
      );

    return memberships.map((m) => ({
      ...Group.format(m),
      memberRole: m.member_role,
      joinedAt: m.joined_at,
    }));
  }

  /**
   * Find groups administered by a user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async findByAdmin(userId) {
    const memberships = await knex('group_members')
      .join('groups', 'group_members.group_id', 'groups.id')
      .where({ 'group_members.user_id': userId, 'group_members.role': 'admin' })
      .select('groups.*');

    return memberships.map(Group.format);
  }

  /**
   * Check if user is an admin of a specific group
   * @param {string} userId
   * @param {string} groupId
   * @returns {Promise<boolean>}
   */
  static async isGroupAdmin(userId, groupId) {
    const membership = await knex('group_members')
      .where({ user_id: userId, group_id: groupId, role: 'admin' })
      .first();
    return !!membership;
  }

  /**
   * Check if user is a member (any role) of a specific group
   * @param {string} userId
   * @param {string} groupId
   * @returns {Promise<boolean>}
   */
  static async isMember(userId, groupId) {
    const membership = await knex('group_members')
      .where({ user_id: userId, group_id: groupId })
      .first();
    return !!membership;
  }

  /**
   * Get member count for a group
   * @param {string} groupId
   * @returns {Promise<number>}
   */
  static async getMemberCount(groupId) {
    const result = await knex('group_members')
      .where('group_id', groupId)
      .count('* as count')
      .first();
    return Number(result?.count || 0);
  }

  /**
   * Find a membership record by its ID
   * @param {string} id - group_members row ID
   * @returns {Promise<Object|null>}
   */
  static async findMemberById(id) {
    const member = await knex('group_members')
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.id', id)
      .select(
        'group_members.id',
        'group_members.group_id',
        'group_members.user_id',
        'group_members.role',
        'group_members.joined_at',
        'users.email',
        'users.first_name',
        'users.last_name',
        'users.is_active',
      )
      .first();

    return member ? Group.formatMember(member) : null;
  }

  /**
   * Format group for API response
   * @param {Object} group
   * @returns {Object}
   */
  static format(group) {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      defaultLocale: group.default_locale || 'pt',
      defaultDecimalSeparator: group.default_decimal_separator || ',',
      defaultDigitGrouping: group.default_digit_grouping || ' ',
      isActive: Boolean(group.is_active),
      createdBy: group.created_by,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    };
  }

  /**
   * Format member for API response
   * @param {Object} member
   * @returns {Object}
   */
  static formatMember(member) {
    return {
      id: member.id,
      groupId: member.group_id,
      userId: member.user_id,
      role: member.role,
      joinedAt: member.joined_at,
      email: member.email,
      firstName: member.first_name,
      lastName: member.last_name,
      isActive: member.is_active !== undefined ? Boolean(member.is_active) : undefined,
    };
  }
}

export default Group;
