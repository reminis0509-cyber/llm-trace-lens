import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('traces', (table) => {
    table.string('id').primary();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    table.string('model').notNullable();
    table.json('request').notNullable();
    table.json('response');
    table.string('status').notNullable(); // 'success', 'error'
    table.integer('latency_ms');
    table.integer('input_tokens');
    table.integer('output_tokens');
    table.string('rule_result'); // 'PASS', 'WARN', 'BLOCK', 'FAIL'
    table.json('rule_violations');
    table.json('metadata');
    table.index(['timestamp']);
    table.index(['model']);
    table.index(['rule_result']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('traces');
}
