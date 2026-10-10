/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema
    .createTable('users', (table) => {
      table.string('id', 36).primary();
      table.string('email').unique().notNullable();
      table.text('password_hash').notNullable();
      table.string('first_name');
      table.string('last_name');
      table.string('role').defaultTo('user');
      table.string('locale').defaultTo('pt');
      table.string('currency').defaultTo('BRL');
      table.string('timezone').defaultTo('Europe/Paris');
      table.boolean('is_active').defaultTo(true);
      table.boolean('email_verified').defaultTo(false);
      table.timestamp('last_login_at');
      table.timestamps(true, true);

      table.index('email');
      table.index('role');
    })
    .createTable('user_settings', (table) => {
      table.string('id', 36).primary();
      table.string('user_id', 36).unique().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      // Display preferences
      table.string('date_format').defaultTo('dd/MM/yyyy');
      table.string('number_format').defaultTo('fr-FR');
      table.integer('week_start_day').defaultTo(1);
      // Dashboard preferences
      table.text('dashboard_layout');
      table.string('default_account_id', 36);
      // Notifications
      table.boolean('email_notifications').defaultTo(true);
      table.boolean('notify_low_balance').defaultTo(true);
      table.decimal('low_balance_threshold', 15, 2).defaultTo(100);
      table.boolean('notify_upcoming_bills').defaultTo(true);
      table.integer('bills_reminder_days').defaultTo(3);
      // Import
      table.text('default_import_config');
      // Other
      table.string('theme').defaultTo('system');
      table.timestamps(true, true);
    });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema
    .dropTableIfExists('user_settings')
    .dropTableIfExists('users');
}
