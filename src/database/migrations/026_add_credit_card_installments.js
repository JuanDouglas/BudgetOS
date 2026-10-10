import { addMonths, endOfMonth, setDate, subDays } from 'date-fns';
import { formatDateISO, generateId, getCycleForPurchase, roundAmount } from '../../utils/helpers.js';

/**
 * Track installment groups for credit-card purchases.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.alterTable('transactions', (table) => {
    table.string('installment_group_id', 36);
    table.integer('installment_number');
    table.integer('installment_count');
    table.index('installment_group_id');
  });

  const cards = await knex('credit_cards').where('debit_type', 'deferred');
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const transactions = await knex('transactions')
    .whereNotNull('credit_card_id')
    .whereNull('credit_card_cycle_id')
    .orderBy('date', 'asc');
  const cyclesByKey = new Map();
  const newCycles = [];
  const assignments = [];

  for (const transaction of transactions) {
    const card = cardsById.get(transaction.credit_card_id);
    if (!card) continue;

    const cycle = getCycleForPurchase(transaction.purchase_date || transaction.date, card.cycle_start_day || 1);
    const key = `${card.id}:${cycle.start}`;
    let cycleRecord = cyclesByKey.get(key);
    if (!cycleRecord) {
      cycleRecord = await knex('credit_card_cycles')
        .where({ credit_card_id: card.id, cycle_start_date: cycle.start })
        .first();
    }

    if (!cycleRecord) {
      const cycleEndDate = new Date(cycle.end);
      let debitDate;
      if (card.debit_day) debitDate = setDate(addMonths(cycleEndDate, 1), card.debit_day);
      else if (card.debit_days_before_end) debitDate = subDays(endOfMonth(addMonths(cycleEndDate, 1)), card.debit_days_before_end);
      else debitDate = setDate(addMonths(cycleEndDate, 1), 5);
      cycleRecord = {
        id: generateId(),
        credit_card_id: card.id,
        cycle_start_date: cycle.start,
        cycle_end_date: cycle.end,
        debit_date: formatDateISO(debitDate),
        status: 'open',
      };
      newCycles.push(cycleRecord);
    }
    cyclesByKey.set(key, cycleRecord);
    assignments.push({ transactionId: transaction.id, cycleId: cycleRecord.id, accountingDate: cycle.end });
  }

  if (newCycles.length > 0) await knex('credit_card_cycles').insert(newCycles);
  for (const assignment of assignments) {
    await knex('transactions')
      .where({ id: assignment.transactionId })
      .update({ credit_card_cycle_id: assignment.cycleId, accounting_date: assignment.accountingDate });
  }

  const touchedCycleIds = await knex('credit_card_cycles')
    .whereIn('credit_card_id', [...cardsById.keys()])
    .pluck('id');
  for (const cycleId of touchedCycleIds) {
    const total = await knex('transactions')
      .where({ credit_card_cycle_id: cycleId })
      .whereNot('status', 'void')
      .sum({ total: knex.raw('ABS(amount)') })
      .first();
    await knex('credit_card_cycles').where({ id: cycleId }).update({ total_amount: roundAmount(total?.total || 0) });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.alterTable('transactions', (table) => {
    table.dropIndex('installment_group_id');
    table.dropColumn('installment_group_id');
    table.dropColumn('installment_number');
    table.dropColumn('installment_count');
  });
}
