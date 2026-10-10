import { z } from 'zod';

/**
 * Schema for creating a group
 */
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name required')
    .max(100, 'Name too long')
    .trim(),
  description: z
    .string()
    .max(500, 'Description too long')
    .trim()
    .optional(),
  defaultLocale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).optional(),
  defaultDecimalSeparator: z.enum(['.', ',']).optional(),
  defaultDigitGrouping: z.enum([',', '.', ' ']).optional(),
});

/**
 * Schema for updating a group
 */
export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name required')
    .max(100, 'Name too long')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description too long')
    .trim()
    .optional(),
  isActive: z.boolean().optional(),
  defaultLocale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).optional(),
  defaultDecimalSeparator: z.enum(['.', ',']).optional(),
  defaultDigitGrouping: z.enum([',', '.', ' ']).optional(),
});

/**
 * Schema for adding a member to a group
 */
export const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID required').optional(),
  email: z.string().email('Invalid email').toLowerCase().trim().optional(),
  password: z
    .string()
    .max(128, 'Password is too long')
    .refine(
      (val) => val.length >= 8 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val),
      'Password must contain at least 8 characters, one lowercase, one uppercase, and one digit'
    )
    .optional(),
  firstName: z.string().max(100).trim().optional(),
  lastName: z.string().max(100).trim().optional(),
  role: z.enum(['admin', 'member']).default('member'),
  locale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).optional(),
  currency: z.enum(['BRL', 'EUR', 'USD', 'GBP', 'CHF']).optional(),
});

/**
 * Schema for updating a member's role
 */
export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], {
    required_error: 'Role required',
    invalid_type_error: 'Invalid role',
  }),
});

/**
 * Schema for group list query params
 */
export const groupListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().max(100).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

/**
 * Schema for member list query params
 */
export const memberListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  role: z.enum(['admin', 'member']).optional(),
});
