/**
 * Make Brazilian Portuguese and BRL the application defaults for new clients.
 * Existing personal user preferences are intentionally left unchanged.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex('system_settings').where({ key: 'default_locale', value: 'fr' }).update({ value: 'pt' });
  await knex('system_settings').where({ key: 'default_digit_grouping', value: ' ' }).update({ value: '.' });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex('system_settings').where({ key: 'default_locale', value: 'pt' }).update({ value: 'fr' });
  await knex('system_settings').where({ key: 'default_digit_grouping', value: '.' }).update({ value: ' ' });
}
