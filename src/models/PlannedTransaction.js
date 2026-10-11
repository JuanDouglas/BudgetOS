import knex from '../database/connection.js';
import dateHelpers from '../database/dateHelpers.js';
import { generateId, formatDateISO } from '../utils/helpers.js';
import { NotFoundError } from '../utils/errors.js';
import { advanceByFrequency } from '../utils/dateFrequency.js';
import Transaction from './Transaction.js';
import { buildUpdates, paginationMeta } from '../utils/modelHelpers.js';

export class PlannedTransaction {
  static async create(userId, data) {
    const id = generateId();
    const nextOccurrence = PlannedTransaction.calculateNextOccurrence(data);

    await knex('planned_transactions').insert({
      id,
      user_id: userId,
      account_id: data.accountId,
      category_id: data.categoryId || null,
      payee_id: data.payeeId || null,
      credit_card_id: data.creditCardId || null,
      to_account_id: data.toAccountId || null,
      amount: data.amount,
      description: data.description,
      notes: data.notes || null,
      type: data.type,
      frequency: data.frequency,
      start_date: data.startDate,
      end_date: data.endDate || null,
      next_occurrence: nextOccurrence,
      auto_create: true,
      execute_before_holiday: !!data.executeBeforeHoliday,
      delete_on_end: !!data.deleteOnEnd,
      days_before_create: data.daysBeforeCreate || 0,
      max_occurrences: data.maxOccurrences || null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
    });

    return PlannedTransaction.findById(id, userId);
  }

  static calculateNextOccurrence(data) {
    const start = new Date(data.startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = data.endDate ? new Date(data.endDate + 'T00:00:00') : null;
    let next = start;

    if (start < today) {
      if (data.frequency === 'once') return null;
      while (next < today) {
        next = advanceByFrequency(next, data.frequency);
      }
    }

    // Check if the next occurrence exceeds the end date
    if (endDate && next > endDate) {
      return null;
    }

    return formatDateISO(next);
  }

  /**
   * Calculate past occurrence dates between startDate and today (exclusive)
   * Used to determine if backfill is needed when creating a planned transaction with a past start date
   */
  static getPastOccurrences(data) {
    const start = new Date(data.startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = data.endDate ? new Date(data.endDate + 'T00:00:00') : null;

    if (start >= today) return [];
    if (data.frequency === 'once') return [formatDateISO(start)];

    const dates = [];
    let current = new Date(start);
    let safety = 0;

    while (current < today && safety < 1000) {
      if (endDate && current > endDate) break;
      dates.push(formatDateISO(current));
      current = advanceByFrequency(current, data.frequency);
      safety++;
    }

    return dates;
  }

  /**
   * Reconcile past occurrences for a planned transaction.
   * Pairs existing transactions (by recurring_id) with expected past dates positionally:
   * - Matched pairs: update the transaction's date to match the expected date
   * - Extra expected dates (no match): create new transactions
   * - Extra existing transactions (no match): return as excess for deletion
   * This handles all cases: schedule changes, date edits, startDate moves.
   */
  static async reconcilePastOccurrences(id, userId, { deleteExcess = false, createMissing = true } = {}) {
    const pt = await PlannedTransaction.findByIdOrFail(id, userId);

    const expectedDates = PlannedTransaction.getPastOccurrences({
      startDate: pt.startDate,
      endDate: pt.endDate,
      frequency: pt.frequency,
    });

    // Get existing transactions for this recurring, sorted by date ASC
    const existingTxs = await knex('transactions')
      .where({ user_id: userId, recurring_id: id })
      .orderBy('date', 'asc')
      .select('id', 'date');

    const updated = [];
    const created = [];
    const excess = [];
    const pairCount = Math.min(existingTxs.length, expectedDates.length);

    // Pair existing transactions with expected dates by position
    for (let i = 0; i < pairCount; i++) {
      const existingDate = formatDateISO(existingTxs[i].date);
      if (existingDate !== expectedDates[i]) {
        // Update the transaction date to match the expected date
        await knex('transactions')
          .where('id', existingTxs[i].id)
          .update({ date: expectedDates[i] });
        updated.push({ id: existingTxs[i].id, from: existingDate, to: expectedDates[i] });
      }
    }

    // Create missing transactions (expected dates beyond existing count)
    for (let i = pairCount; i < expectedDates.length; i++) {
      if (!createMissing) break;
      const tx = await Transaction.create(userId, {
        accountId: pt.accountId,
        categoryId: pt.categoryId,
        payeeId: pt.payeeId,
        creditCardId: pt.creditCardId,
        amount: pt.amount,
        description: pt.description,
        notes: pt.notes,
        date: expectedDates[i],
        type: pt.type,
        isRecurring: true,
        recurringId: id,
        toAccountId: pt.toAccountId,
      });
      created.push(tx);
    }

    // Handle excess transactions (existing beyond expected count)
    for (let i = pairCount; i < existingTxs.length; i++) {
      if (deleteExcess) {
        await knex('transactions').where('id', existingTxs[i].id).del();
      }
      excess.push(existingTxs[i].id);
    }

    // Update occurrences_created counter
    const delta = created.length - (deleteExcess ? excess.length : 0);
    if (delta !== 0) {
      await knex('planned_transactions')
        .where('id', id)
        .update({
          occurrences_created: knex.raw(`CASE WHEN occurrences_created + ${delta} > 0 THEN occurrences_created + ${delta} ELSE 0 END`),
        });
    }

    const missingCount = Math.max(0, expectedDates.length - pairCount);

    return {
      updated: updated.length,
      created: created.length,
      missing: createMissing ? 0 : missingCount,
      excess: excess.length,
      excessDeleted: deleteExcess ? excess.length : 0,
    };
  }

  /**
   * Analyze the difference between existing recurring transactions and expected past occurrences.
   */
  static async analyzePastOccurrences(id, userId) {
    const pt = await PlannedTransaction.findByIdOrFail(id, userId);

    const expectedDates = PlannedTransaction.getPastOccurrences({
      startDate: pt.startDate,
      endDate: pt.endDate,
      frequency: pt.frequency,
    });

    const existingCount = await knex('transactions')
      .where({ user_id: userId, recurring_id: id })
      .count('* as count')
      .first();
    const count = Number(existingCount?.count || 0);

    return {
      missingOccurrences: Math.max(0, expectedDates.length - count),
      excessOccurrences: Math.max(0, count - expectedDates.length),
    };
  }

  static async findById(id, userId) {
    const pt = await knex('planned_transactions as pt')
      .leftJoin('categories as c', 'pt.category_id', 'c.id')
      .leftJoin('accounts as a', 'pt.account_id', 'a.id')
      .leftJoin('accounts as ta', 'pt.to_account_id', 'ta.id')
      .leftJoin('payees as p', 'pt.payee_id', 'p.id')
      .select(
        'pt.*',
        'c.name as category_name',
        'c.icon as category_icon',
        'c.color as category_color',
        'a.name as account_name',
        'ta.name as to_account_name',
        'p.name as payee_name',
        'p.image_url as payee_image_url'
      )
      .where('pt.id', id)
      .andWhere('pt.user_id', userId)
      .first();

    return pt ? PlannedTransaction.format(pt) : null;
  }

  static async findByIdOrFail(id, userId) {
    const pt = await PlannedTransaction.findById(id, userId);
    if (!pt) throw new NotFoundError('Planned transaction not found', 'PLANNED_NOT_FOUND');
    return pt;
  }

  static async findByUser(userId, options = {}) {
    const { accountId, type, frequency, isActive = true, page = 1, limit = 50 } = options;

    const baseQuery = knex('planned_transactions as pt')
      .leftJoin('categories as c', 'pt.category_id', 'c.id')
      .leftJoin('accounts as a', 'pt.account_id', 'a.id')
      .leftJoin('accounts as ta', 'pt.to_account_id', 'ta.id')
      .leftJoin('payees as p', 'pt.payee_id', 'p.id')
      .where('pt.user_id', userId);

    if (accountId) baseQuery.andWhere('pt.account_id', accountId);
    if (type) baseQuery.andWhere('pt.type', type);
    if (frequency) baseQuery.andWhere('pt.frequency', frequency);
    if (isActive !== undefined) baseQuery.andWhere('pt.is_active', !!isActive);

    const countResult = await baseQuery.clone().count('* as count').first();
    const total = countResult?.count || 0;

    const rows = await baseQuery.clone()
      .select(
        'pt.*',
        'c.name as category_name',
        'c.icon as category_icon',
        'c.color as category_color',
        'a.name as account_name',
        'ta.name as to_account_name',
        'p.name as payee_name',
        'p.image_url as payee_image_url'
      )
      .orderBy('pt.next_occurrence', 'asc')
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data: rows.map(PlannedTransaction.format),
      pagination: paginationMeta(page, limit, total),
    };
  }

  static async getUpcoming(userId, days = 30) {
    const planned = await knex('planned_transactions as pt')
      .leftJoin('categories as c', 'pt.category_id', 'c.id')
      .leftJoin('accounts as a', 'pt.account_id', 'a.id')
      .leftJoin('accounts as ta', 'pt.to_account_id', 'ta.id')
      .leftJoin('payees as p', 'pt.payee_id', 'p.id')
      .select(
        'pt.*',
        'c.name as category_name',
        'a.name as account_name',
        'ta.name as to_account_name',
        'p.name as payee_name',
        'p.image_url as payee_image_url'
      )
      .where('pt.user_id', userId)
      .andWhere('pt.is_active', true)
      .andWhereRaw(dateHelpers.dateWithinNextDays(knex, 'pt.next_occurrence', days).toString())
      .orderBy('pt.next_occurrence', 'asc');

    return planned.map(PlannedTransaction.format);
  }

  static async createOccurrence(id, userId, date, amount = null) {
    const pt = await PlannedTransaction.findByIdOrFail(id, userId);

    // Idempotency guard: if an occurrence for this planned transaction already
    // exists on this date (e.g. after a mid-run crash/restart), don't create a
    // duplicate. Still advance next_occurrence so the scheduler moves forward.
    const existing = await knex('transactions')
      .where({ user_id: userId, recurring_id: id, date })
      .first();
    if (existing) {
      await knex('planned_transactions')
        .where('id', id)
        .update({ next_occurrence: PlannedTransaction.advanceNextOccurrence(pt) });
      return null;
    }

    const tx = await Transaction.create(userId, {
      accountId: pt.accountId, categoryId: pt.categoryId, payeeId: pt.payeeId,
      creditCardId: pt.creditCardId, amount: amount || pt.amount, description: pt.description,
      notes: pt.notes, date, type: pt.type, isRecurring: true, recurringId: id, toAccountId: pt.toAccountId,
    });

    await knex('planned_transactions')
      .where('id', id)
      .update({
        last_created_at: date,
        occurrences_created: knex.raw('occurrences_created + 1'),
        next_occurrence: PlannedTransaction.advanceNextOccurrence(pt),
      });

    return tx;
  }

  // Advance next_occurrence by one frequency period from the current next_occurrence.
  // Returning the same value (e.g. via calculateNextOccurrence) would cause the hourly
  // scheduler to re-create the same occurrence on every run.
  static advanceNextOccurrence(pt) {
    if (pt.frequency === 'once') return null;

    // Stop once the configured maximum number of occurrences is reached. pt holds
    // the count BEFORE this occurrence, so after it the total is occurrencesCreated + 1.
    if (pt.maxOccurrences && (pt.occurrencesCreated || 0) + 1 >= pt.maxOccurrences) {
      return null;
    }

    const baseDateStr = pt.nextOccurrence || pt.startDate;
    if (!baseDateStr) return null;
    const next = advanceByFrequency(new Date(baseDateStr + 'T00:00:00'), pt.frequency);

    // Re-anchor the day-of-month to the start date for monthly-family frequencies,
    // so a "31st" schedule doesn't permanently drift to the 28th after February.
    const monthlyFamily = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual'].includes(pt.frequency);
    if (monthlyFamily && pt.startDate) {
      const anchorDay = new Date(pt.startDate + 'T00:00:00').getDate();
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(anchorDay, daysInMonth));
    }

    if (pt.endDate) {
      const end = new Date(pt.endDate + 'T00:00:00');
      if (next > end) return null;
    }
    return formatDateISO(next);
  }

  static async update(id, userId, data) {
    const existing = await PlannedTransaction.findByIdOrFail(id, userId);
    const fields = [
      'account_id', 'category_id', 'payee_id', 'credit_card_id', 'to_account_id', 'amount',
      'description', 'notes', 'type', 'frequency', 'start_date', 'end_date',
      'execute_before_holiday', 'delete_on_end', 'days_before_create', 'is_active', 'max_occurrences', 'tags',
    ];
    const updates = buildUpdates(data, fields, { jsonFields: ['tags'] });

    const scheduleChanged = data.startDate || data.endDate !== undefined || data.frequency;

    // Recalculate next_occurrence if startDate, endDate or frequency changed
    if (scheduleChanged) {
      const updatedData = {
        startDate: data.startDate || existing.startDate,
        endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
        frequency: data.frequency || existing.frequency,
      };
      updates.next_occurrence = PlannedTransaction.calculateNextOccurrence(updatedData);
    }

    if (Object.keys(updates).length > 0) {
      await knex('planned_transactions')
        .where({ id, user_id: userId })
        .update(updates);
    }

    // Auto-reconcile dates of existing transactions when schedule changes
    // This silently updates dates to match the new schedule without user interaction
    if (scheduleChanged) {
      await PlannedTransaction.reconcilePastOccurrences(id, userId, { createMissing: false, deleteExcess: false });
    }

    return PlannedTransaction.findById(id, userId);
  }

  static async delete(id, userId) {
    await PlannedTransaction.findByIdOrFail(id, userId);
    await knex('planned_transactions')
      .where({ id, user_id: userId })
      .del();
    return { deleted: true };
  }

  static format(pt) {
    return {
      id: pt.id, userId: pt.user_id, accountId: pt.account_id, accountName: pt.account_name,
      categoryId: pt.category_id, categoryName: pt.category_name, categoryIcon: pt.category_icon, categoryColor: pt.category_color,
      payeeId: pt.payee_id, payeeName: pt.payee_name, payeeImageUrl: pt.payee_image_url,
      creditCardId: pt.credit_card_id, toAccountId: pt.to_account_id, toAccountName: pt.to_account_name,
      amount: Number(pt.amount), description: pt.description, notes: pt.notes, type: pt.type,
      frequency: pt.frequency, startDate: pt.start_date, endDate: pt.end_date, nextOccurrence: pt.next_occurrence,
      autoCreate: Boolean(pt.auto_create), executeBeforeHoliday: Boolean(pt.execute_before_holiday),
      deleteOnEnd: Boolean(pt.delete_on_end), daysBeforeCreate: pt.days_before_create, isActive: Boolean(pt.is_active),
      lastCreatedAt: pt.last_created_at, occurrencesCreated: pt.occurrences_created,
      maxOccurrences: pt.max_occurrences, tags: pt.tags ? JSON.parse(pt.tags) : [],
      createdAt: pt.created_at, updatedAt: pt.updated_at,
    };
  }
}

export default PlannedTransaction;
