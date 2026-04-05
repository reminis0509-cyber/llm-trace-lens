/**
 * Crawl Pipeline Orchestrator
 * Coordinates crawling with document creation and RAG processing.
 */
import { crawlSite, type CrawlProgressCallback } from './crawler.js';
import { processDocument } from '../rag/pipeline.js';
import {
  getChatbot,
  updateChatbot,
  createDocumentFromUrl,
} from '../storage.js';

/**
 * Run the full crawl pipeline for a chatbot.
 * Validates URL, crawls the site, creates document records, and processes each page.
 */
export async function processCrawl(
  chatbotId: string,
  workspaceId: string,
  url: string
): Promise<void> {
  // Verify chatbot exists and is not already crawling
  const chatbot = await getChatbot(chatbotId, workspaceId);
  if (!chatbot) {
    throw new Error('チャットボットが見つかりません');
  }

  if (chatbot.crawl_status === 'crawling') {
    throw new Error('クロールは既に実行中です');
  }

  try {
    // Set initial status
    await updateChatbot(chatbotId, workspaceId, {
      crawl_url: url,
      crawl_status: 'crawling',
      crawl_progress: JSON.stringify({ pages_found: 0, pages_processed: 0, current_url: url }),
      crawl_error: null,
    });

    // Progress callback to update DB
    const onProgress: CrawlProgressCallback = (progress) => {
      // Fire-and-forget update (do not await to avoid slowing crawl)
      updateChatbot(chatbotId, workspaceId, {
        crawl_progress: JSON.stringify({
          pages_found: progress.pagesFound,
          pages_processed: progress.pagesProcessed,
          current_url: progress.currentUrl,
        }),
      }).catch(() => { /* ignore update errors */ });
    };

    // Execute crawl
    const result = await crawlSite(url, { maxPages: 20 }, onProgress);

    // Process each crawled page
    let processedCount = 0;
    for (const page of result.pages) {
      try {
        // Create document record
        const document = await createDocumentFromUrl(chatbotId, workspaceId, {
          url: page.url,
          title: page.title || page.url,
          content_size: page.contentLength,
        });

        // Convert page content to Buffer and process through RAG pipeline as 'txt' type
        const contentBuffer = Buffer.from(page.content, 'utf-8');
        await processDocument(document.id, chatbotId, workspaceId, contentBuffer, 'txt');

        processedCount++;

        // Update progress
        await updateChatbot(chatbotId, workspaceId, {
          crawl_progress: JSON.stringify({
            pages_found: result.pages.length,
            pages_processed: processedCount,
            current_url: page.url,
          }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ページ処理エラー';
        // Log but continue processing other pages
        console.error(`[CrawlPipeline] ページ処理エラー ${page.url}: ${message}`);
      }
    }

    // Set completed status
    await updateChatbot(chatbotId, workspaceId, {
      crawl_status: 'completed',
      crawl_progress: JSON.stringify({
        pages_found: result.pages.length,
        pages_processed: processedCount,
        current_url: '',
      }),
      crawl_error: result.errors.length > 0
        ? `${result.errors.length}件のページでエラーが発生しました`
        : null,
      crawled_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'クロール中にエラーが発生しました';
    await updateChatbot(chatbotId, workspaceId, {
      crawl_status: 'error',
      crawl_error: message,
    }).catch(() => { /* ignore update errors */ });
  }
}
