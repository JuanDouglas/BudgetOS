import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, addDays, addMonths, differenceInDays, endOfMonth, setDate, subDays } from 'date-fns';

const parseDate = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? parseISO(date)
  : new Date(date);

/**
 * Generate a UUID v4
 */
export const generateId = () => uuidv4();

/**
 * Format an amount with currency
 */
export const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Round an amount to 2 decimals
 */
export const roundAmount = (amount) => {
  return Math.round(amount * 100) / 100;
};

/**
 * Format a date to ISO
 */
export const formatDateISO = (date) => {
  return format(parseDate(date), 'yyyy-MM-dd');
};

/**
 * Format a date in French format
 */
export const formatDateFR = (date) => {
  return format(parseDate(date), 'dd/MM/yyyy');
};

/**
 * Calculate the debit date of a deferred-debit card
 * @param {Date} purchaseDate - Purchase date
 * @param {Object} cardConfig - Card configuration
 * @param {number} cardConfig.cycleStartDay - Cycle start day (e.g. 26)
 * @param {number} cardConfig.debitDay - Debit day (e.g. 5)
 * @param {number} cardConfig.debitDaysBeforeEnd - Alternative: D-X before end of month
 */
export const calculateDeferredDebitDate = (purchaseDate, cardConfig) => {
  const purchase = new Date(purchaseDate);
  const purchaseDay = purchase.getDate();
  
  let billingMonth;
  let debitDate;
  
  // Determine the billing month based on the cycle
  if (purchaseDay >= cardConfig.cycleStartDay) {
    // Purchase in the new cycle -> billed next month
    billingMonth = addMonths(purchase, 1);
  } else {
    // Purchase before the cycle date -> billed this month
    billingMonth = purchase;
  }

  // Calculate the debit date
  if (cardConfig.debitDay) {
    // Fixed day of the month
    debitDate = setDate(addMonths(billingMonth, 1), cardConfig.debitDay);
  } else if (cardConfig.debitDaysBeforeEnd) {
    // D-X before end of month
    const monthEnd = endOfMonth(addMonths(billingMonth, 1));
    debitDate = subDays(monthEnd, cardConfig.debitDaysBeforeEnd);
  } else {
    // Default: the 5th of the next month
    debitDate = setDate(addMonths(billingMonth, 1), 5);
  }
  
  return debitDate;
};

/**
 * Determine the billing cycle of a card operation
 * @param {Date} purchaseDate - Purchase date
 * @param {number} cycleStartDay - Cycle start day
 */
export const getCycleForPurchase = (purchaseDate, cycleStartDay) => {
  const purchase = new Date(purchaseDate);
  const purchaseDay = purchase.getDate();
  
  let cycleStart, cycleEnd;
  
  if (purchaseDay >= cycleStartDay) {
    // New cycle started
    cycleStart = setDate(purchase, cycleStartDay);
    cycleEnd = subDays(setDate(addMonths(purchase, 1), cycleStartDay), 1);
  } else {
    // Previous month's cycle
    cycleStart = setDate(addMonths(purchase, -1), cycleStartDay);
    cycleEnd = subDays(setDate(purchase, cycleStartDay), 1);
  }
  
  return {
    start: formatDateISO(cycleStart),
    end: formatDateISO(cycleEnd),
    label: `${format(cycleStart, 'dd/MM')} - ${format(cycleEnd, 'dd/MM/yyyy')}`,
  };
};

/**
 * Calculate cash-flow forecast
 * @param {number} currentBalance - Current balance
 * @param {Array} plannedTransactions - Planned transactions
 * @param {Array} deferredDebits - Upcoming deferred debits
 * @param {number} days - Horizon in days
 */
export const calculateForecast = (currentBalance, plannedTransactions, deferredDebits, days) => {
  const today = new Date();
  const horizon = addDays(today, days);
  
  let balance = currentBalance;
  const dailyBalances = [];
  
  // Combine all future operations
  const futureOperations = [
    ...plannedTransactions.map(t => ({ date: new Date(t.date), amount: t.amount })),
    ...deferredDebits.map(d => ({ date: new Date(d.debitDate), amount: -d.amount })),
  ].filter(op => op.date >= today && op.date <= horizon)
   .sort((a, b) => a.date - b.date);
  
  // Calculate the balance day by day
  let currentDate = today;
  let opIndex = 0;
  
  while (currentDate <= horizon) {
    while (opIndex < futureOperations.length && 
           formatDateISO(futureOperations[opIndex].date) === formatDateISO(currentDate)) {
      balance += futureOperations[opIndex].amount;
      opIndex++;
    }
    
    dailyBalances.push({
      date: formatDateISO(currentDate),
      balance: roundAmount(balance),
    });
    
    currentDate = addDays(currentDate, 1);
  }
  
  return {
    currentBalance,
    forecastBalance: roundAmount(balance),
    minBalance: Math.min(...dailyBalances.map(d => d.balance)),
    maxBalance: Math.max(...dailyBalances.map(d => d.balance)),
    dailyBalances,
  };
};

/**
 * Detect potential duplicates during import
 * @param {Object} importedTx - Imported transaction
 * @param {Array} existingTxs - Existing transactions
 * @param {number} dateTolerance - Tolerance in days for the date
 * @param {number} amountTolerance - Tolerance in % for the amount
 */
export const findPotentialDuplicates = (importedTx, existingTxs, dateTolerance = 2, amountTolerance = 0.01) => {
  const importDate = new Date(importedTx.date);
  const importAmount = Math.abs(importedTx.amount);
  
  return existingTxs.filter(tx => {
    const txDate = new Date(tx.date);
    const txAmount = Math.abs(tx.amount);
    
    // Check date proximity
    const daysDiff = Math.abs(differenceInDays(importDate, txDate));
    if (daysDiff > dateTolerance) return false;
    
    // Check amount proximity
    const amountDiff = Math.abs(importAmount - txAmount) / importAmount;
    if (amountDiff > amountTolerance) return false;
    
    return true;
  });
};

/**
 * Normalize a description for matching
 */
export const normalizeDescription = (description) => {
  if (!description) return '';
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Keep letters, digits, spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculate a match score between two transactions
 */
export const calculateMatchScore = (tx1, tx2) => {
  let score = 0;

  // Exact amount match: +50 points
  if (tx1.amount === tx2.amount) {
    score += 50;
  } else {
    // Close match: +30 points
    const amountDiff = Math.abs(tx1.amount - tx2.amount) / Math.abs(tx1.amount);
    if (amountDiff <= 0.01) score += 30;
  }

  // Exact date match: +30 points
  const date1 = formatDateISO(tx1.date);
  const date2 = formatDateISO(tx2.date);
  if (date1 === date2) {
    score += 30;
  } else {
    // Close date: +15 points
    const daysDiff = Math.abs(differenceInDays(new Date(date1), new Date(date2)));
    if (daysDiff <= 2) score += 15;
    else if (daysDiff <= 5) score += 5;
  }

  // Description match: +20 points
  const desc1 = normalizeDescription(tx1.description);
  const desc2 = normalizeDescription(tx2.description);
  if (desc1 && desc2) {
    if (desc1 === desc2) {
      score += 20;
    } else if (desc1.includes(desc2) || desc2.includes(desc1)) {
      score += 10;
    }
  }

  // Bonus: same check number: +10 points
  if (tx1.checkNumber && tx2.check_number && tx1.checkNumber === tx2.check_number) {
    score += 10;
  }

  // Bonus: same suggested payee: +5 points
  if (tx1.suggestedPayeeId && tx2.payee_id && tx1.suggestedPayeeId === tx2.payee_id) {
    score += 5;
  }

  return score;
};

/**
 * Paginate an array
 */
export const paginate = (array, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total: array.length,
      totalPages: Math.ceil(array.length / limit),
      hasNext: endIndex < array.length,
      hasPrev: page > 1,
    },
  };
};
