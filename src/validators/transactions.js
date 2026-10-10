import { z } from 'zod';

/**
 * Transaction types
 */
export const transactionTypes = ['income', 'expense', 'transfer'];

/**
 * Transaction statuses
 */
export const transactionStatuses = ['pending', 'cleared', 'reconciled', 'void'];

/**
 * Base transaction schema
 */
const baseTransactionSchema = {
  accountId: z.string().uuid('Invalid account ID'),
  categoryId: z.string().uuid('Invalid category ID').nullable().optional(),
  payeeId: z.string().uuid('Invalid payee ID').nullable().optional(),
  creditCardId: z.string().uuid('Invalid card ID').nullable().optional(),
  amount: z
    .number()
    .finite('Invalid amount')
    .refine((val) => val !== 0, 'Amount cannot be zero'),
  description: z
    .string()
    .min(1, 'Description required')
    .max(255, 'Description too long')
    .trim(),
  notes: z.string().max(1000).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  valueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(),
  type: z.enum(transactionTypes, {
    errorMap: () => ({ message: 'Invalid transaction type' }),
  }),
  status: z.enum(transactionStatuses).default('pending'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  checkNumber: z.string().max(50).nullable().optional(),
};

/**
 * Transaction creation schema
 */
export const createTransactionSchema = z.object({
  ...baseTransactionSchema,
  installmentCount: z.coerce.number().int().min(1).max(36).default(1),
  // accountId can be null for transfers with external source
  accountId: z.string().uuid('Invalid account ID').nullable(),
  // For transfers (can be null or undefined)
  toAccountId: z.string().uuid('Invalid destination account ID').nullable().optional(),
}).refine((data) => {
  // For non-transfers, accountId is required
  if (data.type !== 'transfer' && !data.accountId) {
    return false
  }
  // For transfers, at least one account must be set
  if (data.type === 'transfer' && !data.accountId && !data.toAccountId) {
    return false
  }
  return true
}, {
  message: 'An account is required',
  path: ['accountId'],
});

/**
 * Transaction update schema
 */
export const updateTransactionSchema = z.object({
  ...baseTransactionSchema,
  // accountId can be null for transfers with external source
  accountId: z.string().uuid('Invalid account ID').nullable().optional(),
  amount: baseTransactionSchema.amount.optional(),
  description: z
    .string()
    .min(1, 'Description required')
    .max(255, 'Description too long')
    .trim()
    .optional(),
  date: baseTransactionSchema.date.optional(),
  type: z.enum(transactionTypes).optional(),
  // For transfers: destination account (can be added, changed, or removed)
  toAccountId: z.string().uuid('Invalid destination account ID').nullable().optional(),
}).partial();

/**
 * Split transaction schema
 */
export const transactionSplitSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID').nullable(),
  amount: z.number().finite('Invalid amount'),
  description: z.string().max(255).optional(),
});

/**
 * Split transaction creation schema
 */
export const createSplitTransactionSchema = z.object({
  ...baseTransactionSchema,
  splits: z.array(transactionSplitSchema).min(2, 'At least 2 splits required'),
}).refine((data) => {
  const totalSplits = data.splits.reduce((sum, split) => sum + Math.abs(split.amount), 0);
  return Math.abs(totalSplits - Math.abs(data.amount)) < 0.01;
}, {
  message: 'Split amounts must equal the total amount',
  path: ['splits'],
});

/**
 * Query schema for transaction list
 */
export const listTransactionsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  creditCardId: z.string().uuid().optional(),
  type: z.enum(transactionTypes).optional(),
  status: z.enum(transactionStatuses).optional(),
  isReconciled: z.enum(['true', 'false']).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z.enum(['date', 'amount', 'description', 'created_at', 'payee', 'category', 'account']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * URL parameters schema
 */
export const transactionIdParamSchema = z.object({
  id: z.string().uuid('Invalid transaction ID'),
});

/**
 * Reconciliation schema
 */
export const reconcileTransactionsSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1, 'At least one transaction required'),
  reconcileDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});
