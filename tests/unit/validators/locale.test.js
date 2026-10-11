import { describe, it, expect } from 'vitest'
import { registerSchema, updateProfileSchema } from '../../../src/validators/auth.js'
import { createUserSchema, updateUserSchema, updateSettingsSchema } from '../../../src/validators/admin.js'
import { createGroupSchema, updateGroupSchema, addMemberSchema } from '../../../src/validators/group.js'

const SUPPORTED_LOCALES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'sv', 'zh']

describe('Locale validation', () => {
  describe('registerSchema', () => {
    it('should accept all supported locales including Swedish (sv)', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = registerSchema.safeParse({
          email: 'test@example.com',
          password: 'Password1',
          passwordConfirm: 'Password1',
          firstName: 'Test',
          lastName: 'User',
          locale,
        })
        expect(result.success, `locale '${locale}' should be valid`).toBe(true)
      }
    })

    it('should reject invalid locale', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        passwordConfirm: 'Password1',
        locale: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should default to Portuguese (pt) when no locale provided', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        passwordConfirm: 'Password1',
      })
      expect(result.success).toBe(true)
      expect(result.data.locale).toBe('pt')
    })
  })

  describe('updateProfileSchema', () => {
    it('should accept Swedish locale (sv)', () => {
      const result = updateProfileSchema.safeParse({ locale: 'sv' })
      expect(result.success).toBe(true)
      expect(result.data.locale).toBe('sv')
    })

    it('should accept all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = updateProfileSchema.safeParse({ locale })
        expect(result.success, `locale '${locale}' should be valid`).toBe(true)
      }
    })
  })

  describe('createUserSchema', () => {
    it('should accept Swedish locale (sv)', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        locale: 'sv',
      })
      expect(result.success).toBe(true)
      expect(result.data.locale).toBe('sv')
    })

    it('should accept all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = createUserSchema.safeParse({
          email: 'test@example.com',
          password: 'Password1',
          locale,
        })
        expect(result.success, `locale '${locale}' should be valid`).toBe(true)
      }
    })
  })

  describe('updateUserSchema', () => {
    it('should accept Swedish locale (sv)', () => {
      const result = updateUserSchema.safeParse({ locale: 'sv' })
      expect(result.success).toBe(true)
    })

    it('should accept all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = updateUserSchema.safeParse({ locale })
        expect(result.success, `locale '${locale}' should be valid`).toBe(true)
      }
    })
  })

  describe('updateSettingsSchema', () => {
    it('should accept Swedish as default locale (sv)', () => {
      const result = updateSettingsSchema.safeParse({ defaultLocale: 'sv' })
      expect(result.success).toBe(true)
      expect(result.data.defaultLocale).toBe('sv')
    })

    it('should accept all supported locales as defaultLocale', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = updateSettingsSchema.safeParse({ defaultLocale: locale })
        expect(result.success, `defaultLocale '${locale}' should be valid`).toBe(true)
      }
    })
  })

  describe('createGroupSchema', () => {
    it('should accept Swedish as default locale (sv)', () => {
      const result = createGroupSchema.safeParse({
        name: 'Test Group',
        defaultLocale: 'sv',
      })
      expect(result.success).toBe(true)
      expect(result.data.defaultLocale).toBe('sv')
    })

    it('should accept all supported locales as defaultLocale', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = createGroupSchema.safeParse({
          name: 'Test Group',
          defaultLocale: locale,
        })
        expect(result.success, `defaultLocale '${locale}' should be valid`).toBe(true)
      }
    })
  })

  describe('updateGroupSchema', () => {
    it('should accept Swedish as default locale (sv)', () => {
      const result = updateGroupSchema.safeParse({ defaultLocale: 'sv' })
      expect(result.success).toBe(true)
    })

    it('should accept all supported locales as defaultLocale', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = updateGroupSchema.safeParse({ defaultLocale: locale })
        expect(result.success, `defaultLocale '${locale}' should be valid`).toBe(true)
      }
    })
  })

  describe('addMemberSchema', () => {
    it('should accept Swedish locale (sv)', () => {
      const result = addMemberSchema.safeParse({
        userId: 'user-123',
        locale: 'sv',
      })
      expect(result.success).toBe(true)
      expect(result.data.locale).toBe('sv')
    })

    it('should accept all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        const result = addMemberSchema.safeParse({
          userId: 'user-123',
          locale,
        })
        expect(result.success, `locale '${locale}' should be valid`).toBe(true)
      }
    })
  })
})
