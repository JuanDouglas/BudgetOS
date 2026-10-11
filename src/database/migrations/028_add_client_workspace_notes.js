/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.alterTable('client_workspaces', (table) => {
    table.text('notes');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.alterTable('client_workspaces', (table) => {
    table.dropColumn('notes');
  });
}