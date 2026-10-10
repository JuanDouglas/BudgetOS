import { v4 as uuidv4 } from 'uuid';

/**
 * Add default_locale column to groups table and
 * insert default_locale key in system_settings.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.alterTable('groups', (table) => {
    table.string('default_locale', 10).defaultTo('pt');
  });

  await knex('system_settings').insert({
    id: uuidv4(),
    key: 'default_locale',
    value: 'pt',
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.alterTable('groups', (table) => {
    table.dropColumn('default_locale');
  });

  await knex('system_settings').where('key', 'default_locale').del();
}
