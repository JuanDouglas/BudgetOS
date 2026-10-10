import { z } from 'zod';

/**
 * Registration schema
 */
export const registerSchema = z.object({
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
  passwordConfirm: z.string(),
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
  locale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).default('pt'),
  currency: z.enum(['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD']).default('BRL'),
  decimalSeparator: z.enum(['.', ',']).optional(),
  digitGrouping: z.enum([',', '.', ' ', '']).optional(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Passwords do not match',
  path: ['passwordConfirm'],
}).refine((data) => !data.digitGrouping || data.digitGrouping !== data.decimalSeparator, {
  message: 'Decimal separator and digit grouping cannot be the same',
  path: ['digitGrouping'],
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password required'),
  rememberMe: z.boolean().default(false),
});

/**
 * Profile update schema
 */
export const updateProfileSchema = z.object({
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
  locale: z.enum(['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']).optional(),
  currency: z.enum(['BRL', 'EUR', 'USD', 'GBP', 'CHF', 'CAD']).optional(),
  timezone: z.string().max(50).optional(),
  decimalSeparator: z.enum(['.', ',']).optional(),
  digitGrouping: z.enum([',', '.', ' ', '']).optional(),
}).refine((data) => !data.digitGrouping || data.digitGrouping !== data.decimalSeparator, {
  message: 'Decimal separator and digit grouping cannot be the same',
  path: ['digitGrouping'],
});

/**
 * Password change schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z
    .string()
    .max(128, 'Password is too long')
    .refine(
      (val) => val.length >= 8 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val),
      'Password must contain at least 8 characters, one lowercase, one uppercase, and one digit'
    ),
  newPasswordConfirm: z.string(),
}).refine((data) => data.newPassword === data.newPasswordConfirm, {
  message: 'Passwords do not match',
  path: ['newPasswordConfirm'],
});

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .toLowerCase()
    .trim(),
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token required'),
  password: z
    .string()
    .max(128, 'Password is too long')
    .refine(
      (val) => val.length >= 8 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val),
      'Password must contain at least 8 characters, one lowercase, one uppercase, and one digit'
    ),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Passwords do not match',
  path: ['passwordConfirm'],
});

/**
 * Validate reset token schema
 */
export const validateResetTokenSchema = z.object({
  token: z.string().min(1, 'Token required'),
});
