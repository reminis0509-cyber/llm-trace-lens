import type { Knex } from 'knex';

/**
 * Migration: Add crawler and widget design customization
 * - chatbots: クロール関連カラム + デザインカスタマイズカラム追加
 * - documents: source_url カラム追加
 */
export async function up(knex: Knex): Promise<void> {
  // chatbots table - crawler columns
  const hasChatbots = await knex.schema.hasTable('chatbots');
  if (hasChatbots) {
    const hasCrawlUrl = await knex.schema.hasColumn('chatbots', 'crawl_url');
    if (!hasCrawlUrl) {
      await knex.schema.alterTable('chatbots', (table) => {
        // Crawler
        table.text('crawl_url');
        table.string('crawl_status'); // pending | crawling | completed | error
        table.text('crawl_progress'); // JSON: { pages_found, pages_processed, current_url }
        table.text('crawl_error');
        table.timestamp('crawled_at');

        // Design customization
        table.string('widget_secondary_color').defaultTo('#f3f4f6');
        table.string('widget_border_radius').defaultTo('rounded'); // sharp | rounded | pill
        table.string('widget_header_text');
        table.string('widget_font').defaultTo('system'); // system | noto-sans-jp | hiragino
        table.string('widget_bubble_icon').defaultTo('chat'); // chat | question | headset | custom
        table.string('widget_bubble_icon_url');
        table.string('widget_window_size').defaultTo('standard'); // compact | standard | large
      });
    }
  }

  // documents table - source_url column
  const hasDocuments = await knex.schema.hasTable('documents');
  if (hasDocuments) {
    const hasSourceUrl = await knex.schema.hasColumn('documents', 'source_url');
    if (!hasSourceUrl) {
      await knex.schema.alterTable('documents', (table) => {
        table.text('source_url');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasChatbots = await knex.schema.hasTable('chatbots');
  if (hasChatbots) {
    const hasCrawlUrl = await knex.schema.hasColumn('chatbots', 'crawl_url');
    if (hasCrawlUrl) {
      await knex.schema.alterTable('chatbots', (table) => {
        table.dropColumn('crawl_url');
        table.dropColumn('crawl_status');
        table.dropColumn('crawl_progress');
        table.dropColumn('crawl_error');
        table.dropColumn('crawled_at');
        table.dropColumn('widget_secondary_color');
        table.dropColumn('widget_border_radius');
        table.dropColumn('widget_header_text');
        table.dropColumn('widget_font');
        table.dropColumn('widget_bubble_icon');
        table.dropColumn('widget_bubble_icon_url');
        table.dropColumn('widget_window_size');
      });
    }
  }

  const hasDocuments = await knex.schema.hasTable('documents');
  if (hasDocuments) {
    const hasSourceUrl = await knex.schema.hasColumn('documents', 'source_url');
    if (hasSourceUrl) {
      await knex.schema.alterTable('documents', (table) => {
        table.dropColumn('source_url');
      });
    }
  }
}
