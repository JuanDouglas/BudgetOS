import { z } from 'zod';

const currencies = ['BRL', 'CAD', 'CHF', 'EUR', 'GBP', 'USD'];
const locales = ['de', 'en', 'es', 'fr', 'it', 'pt', 'ru', 'sv', 'zh'];

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  currency: z.enum(currencies).optional(),
  locale: z.enum(locales).optional(),
  decimalSeparator: z.enum([',', '.']).optional(),
  digitGrouping: z.enum([' ', ',', '.', '']).optional(),
}).refine((data) => !data.digitGrouping || data.digitGrouping !== data.decimalSeparator, {
  message: 'Decimal separator and digit grouping cannot be the same',
  path: ['digitGrouping'],
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid(),
});
