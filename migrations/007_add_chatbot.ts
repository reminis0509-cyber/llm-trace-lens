import type { Knex } from 'knex';

/**
 * Migration: Add chatbot platform tables
 * - chatbots: チャットbot定義
 * - documents: アップロードドキュメント
 * - document_chunks: チャンク + ベクトル
 * - chat_sessions: エンドユーザー会話セッション
 * - chat_messages: 個別メッセージ
 * - exchange_rates: 日次為替レート
 */
export async function up(knex: Knex): Promise<void> {
  // chatbots
  const hasChatbots = await knex.schema.hasTable('chatbots');
  if (!hasChatbots) {
    await knex.schema.createTable('chatbots', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable();
      table.string('name').notNullable();
      table.text('system_prompt');
      table.string('tone').defaultTo('polite'); // polite / casual / business
      table.text('welcome_message');
      table.string('model').defaultTo('gpt-4o-mini');
      table.float('temperature').defaultTo(0.3);
      table.integer('max_tokens').defaultTo(1024);
      // widget design
      table.string('widget_color').defaultTo('#2563eb');
      table.string('widget_position').defaultTo('bottom-right');
      table.string('widget_logo_url');
      // publish
      table.string('publish_key').unique();
      table.boolean('is_published').defaultTo(false);
      table.text('allowed_origins'); // JSON array of allowed domains
      // limits
      table.integer('rate_limit_per_minute').defaultTo(10);
      table.integer('daily_message_limit').defaultTo(1000);
      table.integer('monthly_token_budget');
      // timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('workspace_id');
    });
  }

  // documents
  const hasDocuments = await knex.schema.hasTable('documents');
  if (!hasDocuments) {
    await knex.schema.createTable('documents', (table) => {
      table.string('id').primary();
      table.string('chatbot_id').notNullable();
      table.string('workspace_id').notNullable();
      table.string('filename').notNullable();
      table.string('file_type').notNullable(); // pdf / txt / csv / json
      table.integer('file_size');
      table.integer('chunk_count').defaultTo(0);
      table.string('status').defaultTo('processing'); // processing / ready / error
      table.text('error_message');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('chatbot_id');
      table.index('workspace_id');
    });
  }

  // document_chunks
  const hasChunks = await knex.schema.hasTable('document_chunks');
  if (!hasChunks) {
    await knex.schema.createTable('document_chunks', (table) => {
      table.string('id').primary();
      table.string('document_id').notNullable();
      table.string('chatbot_id').notNullable();
      table.string('workspace_id').notNullable();
      table.text('content').notNullable();
      table.integer('chunk_index').notNullable();
      table.integer('token_count');
      // embedding stored as JSON text for SQLite compatibility
      // PostgreSQL with pgvector uses raw SQL for vector column
      table.text('embedding_json');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('document_id');
      table.index('chatbot_id');
      table.index('workspace_id');
    });
  }

  // Add pgvector embedding column for PostgreSQL only
  const client = knex.client.config.client;
  if (client === 'pg' || client === 'postgresql') {
    try {
      await knex.raw('CREATE EXTENSION IF NOT EXISTS vector');
      const hasEmbeddingCol = await knex.schema.hasColumn('document_chunks', 'embedding');
      if (!hasEmbeddingCol) {
        await knex.raw('ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)');
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)');
      }
    } catch {
      // pgvector not available, fall back to embedding_json
      console.warn('[Migration] pgvector extension not available, using JSON embeddings fallback');
    }
  }

  // chat_sessions
  const hasSessions = await knex.schema.hasTable('chat_sessions');
  if (!hasSessions) {
    await knex.schema.createTable('chat_sessions', (table) => {
      table.string('id').primary();
      table.string('chatbot_id').notNullable();
      table.string('workspace_id').notNullable();
      table.string('visitor_id');
      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('last_message_at');
      table.integer('message_count').defaultTo(0);
      table.text('metadata'); // JSON: user_agent, referrer, page_url

      table.index('chatbot_id');
      table.index('workspace_id');
      table.index('visitor_id');
    });
  }

  // chat_messages
  const hasMessages = await knex.schema.hasTable('chat_messages');
  if (!hasMessages) {
    await knex.schema.createTable('chat_messages', (table) => {
      table.string('id').primary();
      table.string('session_id').notNullable();
      table.string('chatbot_id').notNullable();
      table.string('workspace_id').notNullable();
      table.string('role').notNullable(); // user / assistant
      table.text('content').notNullable();
      table.text('source_chunks'); // JSON: referenced chunk IDs
      table.integer('token_count');
      table.integer('latency_ms');
      table.string('trace_id'); // FK → traces
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('session_id');
      table.index('chatbot_id');
      table.index('workspace_id');
      table.index('trace_id');
    });
  }

  // exchange_rates
  const hasRates = await knex.schema.hasTable('exchange_rates');
  if (!hasRates) {
    await knex.schema.createTable('exchange_rates', (table) => {
      table.string('id').primary();
      table.string('date').notNullable().unique(); // YYYY-MM-DD
      table.float('usd_jpy').notNullable();
      table.string('source');
      table.timestamp('fetched_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('exchange_rates');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');
  await knex.schema.dropTableIfExists('document_chunks');
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('chatbots');
}
