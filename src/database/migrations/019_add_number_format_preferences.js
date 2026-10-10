import { v4 as uuidv4 } from 'uuid';

/**
 * Add decimal_separator and digit_grouping preferences to users, groups,
 * and system_settings — following the same pattern as default_locale.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  // Users table: personal preferences
  await knex.schema.alterTable('users', (table) => {
    table.string('decimal_separator', 1).defaultTo(',');
    table.string('digit_grouping', 1).defaultTo(' ');
  });

  // Groups table: default values for new members
  await knex.schema.alterTable('groups', (table) => {
    table.string('default_decimal_separator', 1).defaultTo(',');
    table.string('default_digit_grouping', 1).defaultTo('.');
  });

  // System settings: application-wide defaults
  await knex('system_settings').insert([
    { id: uuidv4(), key: 'default_decimal_separator', value: ',' },
    { id: uuidv4(), key: 'default_digit_grouping', value: '.' },
  ]);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('decimal_separator');
    table.dropColumn('digit_grouping');
  });

  await knex.schema.alterTable('groups', (table) => {
    table.dropColumn('default_decimal_separator');
    table.dropColumn('default_digit_grouping');
  });

  await knex('system_settings').where('key', 'default_decimal_separator').del();
  await knex('system_settings').where('key', 'default_digit_grouping').del();
}
