/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.alterTable('client_workspaces', (table) => {
    table.boolean('is_active').notNullable().defaultTo(true);
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.alterTable('client_workspaces', (table) => {
    table.dropColumn('is_active');
  });
}