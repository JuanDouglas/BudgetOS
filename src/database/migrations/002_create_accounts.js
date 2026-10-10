/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('accounts', (table) => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').notNullable();
    table.string('institution');
    table.string('account_number');
    table.decimal('initial_balance', 15, 2).defaultTo(0);
    table.decimal('current_balance', 15, 2).defaultTo(0);
    table.string('currency').defaultTo('BRL');
    table.string('color').defaultTo('#3B82F6');
    table.string('icon').defaultTo('wallet');
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_included_in_total').defaultTo(true);
    table.text('notes');
    table.integer('sort_order').defaultTo(0);
    table.timestamps(true, true);

    table.index('user_id');
    table.index('type');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('accounts');
}
