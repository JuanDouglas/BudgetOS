import { z } from 'zod';

/**
 * Schema for creating a user via admin
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .max(255, 'Email too long')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .max(128, 'Password is too long')
    .refine(
      (val) => val.length >= 8 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val),
      'Password must contain at least 8 characters, one lowercase, one uppercase, and one digit'
    ),
  firstName: z
    .string()
    .min(1, 'First name required')
    .max(100, 'First name too long')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name required')
    .max(100, 'Last name too long')
    .trim()
    .optional(),
  role: z.enum(['user', 'admin']).default('user'),
  groupId: z.string().min(1, 'Group ID required').optional(),
  locale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).default('pt'),
  currency: z.enum(['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD']).default('BRL'),
  decimalSeparator: z.enum(['.', ',']).optional(),
  digitGrouping: z.enum([',', '.', ' ', '']).optional(),
}).refine((data) => !data.digitGrouping || data.digitGrouping !== data.decimalSeparator, {
  message: 'Decimal separator and digit grouping cannot be the same',
  path: ['digitGrouping'],
});

/**
 * Schema for updating a user via admin (partial update)
 */
export const updateUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .max(255, 'Email too long')
    .toLowerCase()
    .trim()
    .optional(),
  firstName: z
    .string()
    .min(1, 'First name required')
    .max(100, 'First name too long')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name required')
    .max(100, 'Last name too long')
    .trim()
    .optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
  locale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).optional(),
  currency: z.enum(['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD']).optional(),
  decimalSeparator: z.enum(['.', ',']).optional(),
  digitGrouping: z.enum([',', '.', ' ', '']).optional(),
}).refine((data) => !data.digitGrouping || data.digitGrouping !== data.decimalSeparator, {
  message: 'Decimal separator and digit grouping cannot be the same',
  path: ['digitGrouping'],
});

/**
 * Schema for updating user role
 */
export const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin'], {
    required_error: 'Role required',
    invalid_type_error: 'Invalid role (user or admin)',
  }),
});

/**
 * Schema for system settings update
 */
export const updateSettingsSchema = z.object({
  allowPublicRegistration: z.boolean().optional(),
  defaultRegistrationGroupId: z.string().nullable().optional(),
  defaultLocale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).optional(),
  defaultDecimalSeparator: z.enum(['.', ',']).optional(),
  defaultDigitGrouping: z.enum([',', '.', ' ']).optional(),
});

/**
 * Schema for admin user list query params
 */
export const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
  groupId: z.string().optional(),
});
