/**
 * Client workspaces keep each client's finance records under a dedicated data user.
 * That identity is internal and cannot authenticate; membership belongs to real users.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_workspace_identity').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('client_workspaces', (table) => {
    table.string('id', 36).primary();
    table.string('name').notNullable();
    table.string('data_user_id', 36).notNullable().unique()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('created_by', 36).notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('currency', 3).notNullable().defaultTo('BRL');
    table.string('locale', 10).notNullable().defaultTo('pt');
    table.string('decimal_separator', 1).notNullable().defaultTo(',');
    table.string('digit_grouping', 1).notNullable().defaultTo('.');
    table.boolean('is_personal').notNullable().defaultTo(false);
    table.timestamps(true, true);
    table.index('name');
  });

  await knex.schema.createTable('client_workspace_members', (table) => {
    table.string('id', 36).primary();
    table.string('workspace_id', 36).notNullable()
      .references('id').inTable('client_workspaces').onDelete('CASCADE');
    table.string('user_id', 36).notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('role').notNullable().defaultTo('owner');
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.unique(['workspace_id', 'user_id']);
    table.index('user_id');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('client_workspace_members');
  await knex.schema.dropTableIfExists('client_workspaces');
  await knex('users').where('is_workspace_identity', true).del();
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_workspace_identity');
  });
}
