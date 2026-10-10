import knex from '../database/connection.js';
import { generateId } from '../utils/helpers.js';

/**
 * SystemSetting model for managing application-wide settings
 */
export class SystemSetting {
  /**
   * Get a single setting value by key
   * @param {string} key - Setting key
   * @returns {Promise<string|null>}
   */
  static async get(key) {
    const row = await knex('system_settings').where('key', key).first();
    return row ? row.value : null;
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {string|null} value - Setting value
   * @param {string} [updatedBy] - User ID of who made the change
   */
  static async set(key, value, updatedBy = null) {
    const existing = await knex('system_settings').where('key', key).first();

    if (existing) {
      await knex('system_settings')
        .where('key', key)
        .update({
          value,
          updated_by: updatedBy,
        });
    } else {
      await knex('system_settings').insert({
        id: generateId(),
        key,
        value,
        updated_by: updatedBy,
      });
    }
  }

  /**
   * Get all settings as key-value object
   * @returns {Promise<Object>}
   */
  static async getAll() {
    const rows = await knex('system_settings').select('key', 'value');
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  /**
   * Get all settings formatted for API response
   * @returns {Promise<Object>}
   */
  static async getAllFormatted() {
    const settings = await SystemSetting.getAll();
    return {
      allowPublicRegistration: settings.allow_public_registration === 'true',
      defaultRegistrationGroupId: settings.default_registration_group_id || null,
      defaultLocale: settings.default_locale || 'pt',
      defaultDecimalSeparator: settings.default_decimal_separator || ',',
      defaultDigitGrouping: settings.default_digit_grouping || '.',
    };
  }
}

export default SystemSetting;
