import knex from '../database/connection.js';
import { roundAmount, formatDateISO } from '../utils/helpers.js';
import { addDays, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import dateHelpers from '../database/dateHelpers.js';
import Account from '../models/Account.js';
import { advanceByFrequency } from '../utils/dateFrequency.js';

export class ForecastService {
  /**
   * Calculate cash flow forecast for an account
   */
  static async calculateForecast(userId, accountId, days = 90) {
    const account = await Account.findByIdOrFail(accountId, userId);
    const today = new Date();
    const horizon = addDays(today, days);
    const todayStr = formatDateISO(today);
    const horizonStr = formatDateISO(horizon);

    // Get planned transactions
    const planned = await knex('planned_transactions')
      .where('user_id', userId)
      .where(function () {
        this.where('account_id', accountId).orWhere('to_account_id', accountId);
      })
      .where('is_active', true)
      .where(function () {
        this.whereNull('end_date').orWhere('end_date', '>=', todayStr);
      });

    // Get upcoming deferred debits
    const deferredDebits = await knex('credit_card_cycles as ccc')
      .join('credit_cards as cc', 'ccc.credit_card_id', 'cc.id')
      .select('cc.name as card_name', 'ccc.debit_date', 'ccc.total_amount')
      .where('cc.user_id', userId)
      .where('cc.linked_account_id', accountId)
      .whereIn('ccc.status', ['open', 'pending'])
      .whereBetween('ccc.debit_date', [todayStr, horizonStr]);

    // Generate future occurrences of planned transactions
    const futureTransactions = [];
    for (const pt of planned) {
      const occurrences = ForecastService.generateOccurrences(pt, today, horizon);
      for (const date of occurrences) {
        // Coerce to Number: pg/mysql drivers return decimal columns as strings,
        // which would turn balance arithmetic into string concatenation (NaN).
        const ptAmount = Number(pt.amount);
        const amount = pt.account_id === accountId ? ptAmount : -ptAmount;
        futureTransactions.push({
          date: formatDateISO(date),
          amount,
          description: pt.description,
          type: 'planned',
          sourceId: pt.id,
        });
      }
    }

    // Add deferred debits
    for (const debit of deferredDebits) {
      futureTransactions.push({
        date: debit.debit_date,
        amount: -Number(debit.total_amount),
        description: `Debit ${debit.card_name}`,
        type: 'deferred_debit',
      });
    }

    // Sort by date
    futureTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate daily balances
    let balance = account.currentBalance;
    const dailyBalances = [];
    const interval = eachDayOfInterval({ start: today, end: horizon });

    let txIndex = 0;
    for (const day of interval) {
      const dayStr = formatDateISO(day);
      const dayTransactions = [];

      while (txIndex < futureTransactions.length && futureTransactions[txIndex].date === dayStr) {
        balance += futureTransactions[txIndex].amount;
        dayTransactions.push(futureTransactions[txIndex]);
        txIndex++;
      }

      dailyBalances.push({
        date: dayStr,
        balance: roundAmount(balance),
        transactions: dayTransactions,
      });
    }

    const balances = dailyBalances.map(d => d.balance);
    const minBalance = Math.min(...balances);
    return {
      accountId,
      accountName: account.name,
      currentBalance: account.currentBalance,
      forecast: {
        days30: ForecastService.getBalanceAtDay(dailyBalances, 30),
        days60: ForecastService.getBalanceAtDay(dailyBalances, 60),
        days90: ForecastService.getBalanceAtDay(dailyBalances, 90),
      },
      minBalance,
      maxBalance: Math.max(...balances),
      minBalanceDate: dailyBalances.find(d => d.balance === minBalance)?.date,
      dailyBalances,
      upcomingTransactions: futureTransactions.slice(0, 20),
    };
  }

  static getBalanceAtDay(dailyBalances, day) {
    return dailyBalances[Math.min(day, dailyBalances.length - 1)]?.balance || 0;
  }

  static generateOccurrences(planned, start, end) {
    const occurrences = [];
    let current = new Date(planned.next_occurrence || planned.start_date);
    const endDate = planned.end_date ? new Date(planned.end_date) : end;
    const maxDate = new Date(Math.min(end.getTime(), endDate.getTime()));

    // Compare on the calendar date, not the timestamp: `start` carries the
    // current time-of-day, so an occurrence dated today (midnight) would
    // otherwise be wrongly excluded.
    const startStr = formatDateISO(start);
    while (current <= maxDate) {
      if (formatDateISO(current) >= startStr) occurrences.push(new Date(current));
      if (planned.frequency === 'once') return occurrences;
      current = advanceByFrequency(current, planned.frequency);
    }
    return occurrences;
  }

  /**
   * Calculate global forecast for all accounts
   */
  static async calculateGlobalForecast(userId, days = 90) {
    const accounts = await knex('accounts')
      .select('id', 'name', 'current_balance')
      .where({ user_id: userId, is_active: true, is_included_in_total: true })
      .whereNot('type', 'credit_card');

    const forecasts = await Promise.all(
      accounts.map(acc => ForecastService.calculateForecast(userId, acc.id, days))
    );

    const today = new Date();
    const horizon = addDays(today, days);
    const interval = eachDayOfInterval({ start: today, end: horizon });

    // Aggregate balances
    const globalDaily = interval.map((day) => {
      const dayStr = formatDateISO(day);
      const totalBalance = forecasts.reduce((sum, f) => {
        const dayData = f.dailyBalances.find(d => d.date === dayStr);
        return sum + (dayData?.balance || 0);
      }, 0);
      return { date: dayStr, balance: roundAmount(totalBalance) };
    });

    const currentTotal = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);
    const balances = globalDaily.map(d => d.balance);

    return {
      currentBalance: roundAmount(currentTotal),
      forecast: {
        days30: globalDaily[Math.min(30, globalDaily.length - 1)]?.balance || 0,
        days60: globalDaily[Math.min(60, globalDaily.length - 1)]?.balance || 0,
        days90: globalDaily[Math.min(90, globalDaily.length - 1)]?.balance || 0,
      },
      minBalance: Math.min(...balances),
      maxBalance: Math.max(...balances),
      dailyBalances: globalDaily,
      accountForecasts: forecasts.map(f => ({
        accountId: f.accountId,
        accountName: f.accountName,
        currentBalance: f.currentBalance,
        forecast30: f.forecast.days30,
      })),
    };
  }

  /**
   * Monthly forecast summary
   */
  static async getMonthlyForecast(userId, months = 3) {
    const today = new Date();
    const globalStart = formatDateISO(startOfMonth(today));
    const globalEnd = formatDateISO(endOfMonth(addMonths(today, months)));

    const yearMonthExpr = dateHelpers.yearMonth(knex, 'next_occurrence');
    const yearMonthDebitExpr = dateHelpers.yearMonth(knex, 'ccc.debit_date');

    // Batch query: all planned transactions grouped by month
    const [plannedRows, deferredRows] = await Promise.all([
      knex('planned_transactions')
        .where('user_id', userId)
        .where('is_active', true)
        .whereBetween('next_occurrence', [globalStart, globalEnd])
        .select(
          knex.raw(`${yearMonthExpr} as month_key`),
          knex.raw("SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income"),
          knex.raw("SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses"),
        )
        .groupByRaw(yearMonthExpr),
      knex('credit_card_cycles as ccc')
        .join('credit_cards as cc', 'ccc.credit_card_id', 'cc.id')
        .where('cc.user_id', userId)
        .whereBetween('ccc.debit_date', [globalStart, globalEnd])
        .select(knex.raw(`${yearMonthDebitExpr} as month_key`))
        .sum('ccc.total_amount as total')
        .groupByRaw(yearMonthDebitExpr),
    ]);

    const plannedMap = {};
    for (const row of plannedRows) {
      plannedMap[row.month_key] = row;
    }
    const deferredMap = {};
    for (const row of deferredRows) {
      deferredMap[row.month_key] = row;
    }

    const result = [];
    for (let i = 0; i <= months; i++) {
      const monthStart = startOfMonth(addMonths(today, i));
      const key = formatDateISO(monthStart).slice(0, 7);
      const planned = plannedMap[key];
      const deferred = deferredMap[key];

      // Coerce to Number: pg/mysql return SUM()/decimal aggregates as strings.
      const income = Number(planned?.income) || 0;
      const expenses = (Number(planned?.expenses) || 0) + (Number(deferred?.total) || 0);
      result.push({
        month: key,
        plannedIncome: income,
        plannedExpenses: expenses,
        netFlow: income - expenses,
      });
    }

    return result;
  }
  /**
   * Get merged list of actual + projected transactions for a date range.
   * Projected entries are generated from planned_transactions.
   * Deduplicates: if an actual tx exists with same recurring_id + date, skip projected.
   */
  static async getForecastTransactions(userId, options = {}) {
    const { startDate, endDate, accountId, categoryId, type, search, isReconciled } = options;

    // 1. Fetch actual transactions in the period
    let txQuery = knex('transactions as t')
      .leftJoin('categories as c', 't.category_id', 'c.id')
      .leftJoin('accounts as a', 't.account_id', 'a.id')
      .leftJoin('payees as p', 't.payee_id', 'p.id')
      .select(
        't.id', 't.date', 't.amount', 't.description', 't.type', 't.status',
        't.is_reconciled', 't.recurring_id', 't.account_id',
        'c.id as category_id', 'c.name as category_name', 'c.icon as category_icon', 'c.color as category_color',
        'a.name as account_name', 'a.color as account_color',
        'p.id as payee_id', 'p.name as payee_name', 'p.image_url as payee_image_url',
      )
      .where('t.user_id', userId)
      .whereNot('t.status', 'void')
      .whereBetween('t.date', [startDate, endDate])
      .orderBy('t.date', 'asc');

    if (accountId) txQuery = txQuery.where('t.account_id', accountId);
    if (categoryId) txQuery = txQuery.where('t.category_id', categoryId);
    if (type) txQuery = txQuery.where('t.type', type);
    if (isReconciled !== undefined && isReconciled !== '') {
      txQuery = txQuery.where('t.is_reconciled', isReconciled === 'true' || isReconciled === true);
    }
    if (search) {
      const likeOp = dateHelpers.likeOperator(knex);
      txQuery = txQuery.where(function () {
        this.where('t.description', likeOp, `%${search}%`)
          .orWhere('p.name', likeOp, `%${search}%`);
      });
    }

    const actualTxs = await txQuery;

    // Build set of existing recurring dates for deduplication
    const existingRecurringDates = new Set();
    for (const tx of actualTxs) {
      if (tx.recurring_id) {
        existingRecurringDates.add(`${tx.recurring_id}_${tx.date}`);
      }
    }

    // Format actual transactions
    const formattedActual = actualTxs.map(tx => ({
      id: tx.id,
      date: tx.date,
      amount: Number(tx.amount),
      description: tx.description,
      type: tx.type,
      status: tx.status,
      isReconciled: Boolean(tx.is_reconciled),
      accountId: tx.account_id,
      accountName: tx.account_name,
      accountColor: tx.account_color,
      categoryId: tx.category_id,
      categoryName: tx.category_name,
      categoryIcon: tx.category_icon,
      categoryColor: tx.category_color,
      payeeId: tx.payee_id,
      payeeName: tx.payee_name,
      payeeImageUrl: tx.payee_image_url,
      recurringId: tx.recurring_id,
      source: 'actual',
    }));

    // 2. Fetch planned transactions and generate projected occurrences
    let ptQuery = knex('planned_transactions as pt')
      .leftJoin('categories as c', 'pt.category_id', 'c.id')
      .leftJoin('accounts as a', 'pt.account_id', 'a.id')
      .leftJoin('payees as p', 'pt.payee_id', 'p.id')
      .select(
        'pt.id', 'pt.amount', 'pt.description', 'pt.type', 'pt.frequency',
        'pt.start_date', 'pt.end_date', 'pt.next_occurrence', 'pt.account_id',
        'c.id as category_id', 'c.name as category_name', 'c.icon as category_icon', 'c.color as category_color',
        'a.name as account_name', 'a.color as account_color',
        'p.id as payee_id', 'p.name as payee_name', 'p.image_url as payee_image_url',
      )
      .where('pt.user_id', userId)
      .where('pt.is_active', true);

    if (accountId) ptQuery = ptQuery.where('pt.account_id', accountId);
    if (categoryId) ptQuery = ptQuery.where('pt.category_id', categoryId);
    if (type) ptQuery = ptQuery.where('pt.type', type);

    const plannedTxs = await ptQuery;

    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const projectedTxs = [];

    for (const pt of plannedTxs) {
      const occurrences = ForecastService.generateOccurrences(pt, startD, endD);
      for (const date of occurrences) {
        const dateStr = formatDateISO(date);

        // Skip if an actual transaction already covers this occurrence
        if (existingRecurringDates.has(`${pt.id}_${dateStr}`)) continue;

        // Apply search filter on projected too
        if (search && !pt.description.toLowerCase().includes(search.toLowerCase())
            && (!pt.payee_name || !pt.payee_name.toLowerCase().includes(search.toLowerCase()))) continue;

        projectedTxs.push({
          id: `projected-${pt.id}-${dateStr}`,
          date: dateStr,
          amount: Number(pt.amount),
          description: pt.description,
          type: pt.type,
          status: 'projected',
          isReconciled: false,
          accountId: pt.account_id,
          accountName: pt.account_name,
          accountColor: pt.account_color,
          categoryId: pt.category_id,
          categoryName: pt.category_name,
          categoryIcon: pt.category_icon,
          categoryColor: pt.category_color,
          payeeId: pt.payee_id,
          payeeName: pt.payee_name,
          payeeImageUrl: pt.payee_image_url,
          recurringId: pt.id,
          source: 'projected',
        });
      }
    }

    if ((!type || type === 'expense') && isReconciled !== 'true' && !categoryId) {
      let cycleQuery = knex('credit_card_cycles as ccc')
        .join('credit_cards as cc', 'ccc.credit_card_id', 'cc.id')
        .leftJoin('accounts as a', 'cc.linked_account_id', 'a.id')
        .select('ccc.id', 'ccc.debit_date', 'ccc.total_amount', 'cc.name as card_name', 'cc.linked_account_id', 'a.name as account_name', 'a.color as account_color')
        .where('cc.user_id', userId)
        .whereIn('ccc.status', ['open', 'pending'])
        .where('ccc.total_amount', '>', 0)
        .whereBetween('ccc.debit_date', [startDate, endDate])
        .whereNotNull('cc.linked_account_id');

      if (accountId) cycleQuery = cycleQuery.where('cc.linked_account_id', accountId);

      const cycles = await cycleQuery;
      for (const cycle of cycles) {
        const description = `Fatura de cartão: ${cycle.card_name}`;
        if (search && !description.toLowerCase().includes(search.toLowerCase())
            && !cycle.card_name.toLowerCase().includes(search.toLowerCase())) continue;

        projectedTxs.push({
          id: `projected-card-cycle-${cycle.id}`,
          date: cycle.debit_date,
          amount: -Number(cycle.total_amount),
          description,
          type: 'expense',
          status: 'projected',
          isReconciled: false,
          accountId: cycle.linked_account_id,
          accountName: cycle.account_name,
          accountColor: cycle.account_color,
          categoryId: null,
          categoryName: 'Fatura de cartão',
          payeeName: cycle.card_name,
          source: 'projected',
          sourceType: 'card_debit',
        });
      }
    }

    // 3. Merge and sort by date ASC
    const merged = [...formattedActual, ...projectedTxs]
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      data: merged,
      period: { startDate, endDate },
      counts: {
        total: merged.length,
        actual: formattedActual.length,
        projected: projectedTxs.length,
      },
    };
  }
}

export default ForecastService;
